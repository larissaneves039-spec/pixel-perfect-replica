// Worker de renderização do GitHub Actions.
// Pega o próximo vídeo "Na fila" no Supabase, renderiza em um Chrome headless
// (tempo real, igual ao navegador) e envia as partes para o Supabase Storage.
// Fala direto com o banco usando a service-role key: o app é hospedado em
// site estático (GitHub Pages), então não existe servidor para rotas de worker.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

const APP_URL = process.env["APP_URL"] || "http://localhost:4173";
const SUPABASE_URL = process.env["SUPABASE_URL"];
const SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const PEXELS_API_KEY = process.env["PEXELS_API_KEY"] || "";
const MAX_RUN_MS = 5 * 60 * 60 * 1000; // margem dentro do timeout do workflow

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Faltam variáveis: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
});

interface ClaimedJob {
  video: {
    id: string;
    title: string;
    user_id: string;
    total_seconds: number;
    scenes: unknown;
    settings: unknown;
  };
  audioUrl: string | null;
}

async function claim(): Promise<ClaimedJob | null> {
  const { data, error } = await admin.rpc("claim_video_job");
  if (error) throw new Error(`claim falhou: ${error.message}`);
  if (!data || typeof data !== "object" || !("id" in data) || !data.id) return null;
  const row = data as { id: string; audio_path: string | null };
  let audioUrl: string | null = null;
  if (row.audio_path) {
    const { data: signed } = await admin.storage.from("videos").createSignedUrl(row.audio_path, 60 * 60 * 8);
    audioUrl = signed?.signedUrl ?? null;
  }
  return { video: data as unknown as ClaimedJob["video"], audioUrl };
}

async function waitForApp(): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(APP_URL);
      if (res.ok) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`O app não respondeu em ${APP_URL}`);
}

async function complete(videoId: string, paths: string[]): Promise<void> {
  const { error } = await admin
    .from("videos")
    .update({ status: "done", output_paths: paths, error: null, locked_at: null })
    .eq("id", videoId)
    .eq("status", "rendering");
  if (error) console.error(`Falha ao salvar a conclusão: ${error.message}`);
}

async function fail(videoId: string, message: string): Promise<void> {
  const { error } = await admin
    .from("videos")
    .update({ status: "error", error: message, locked_at: null })
    .eq("id", videoId);
  if (error) console.error(`Falha ao registrar o erro: ${error.message}`);
}

const DOWNLOADS = "/tmp/render-worker-downloads";

async function renderOne(job: ClaimedJob): Promise<void> {
  await rm(DOWNLOADS, { recursive: true, force: true });
  await mkdir(DOWNLOADS, { recursive: true });

  let browser;
  try {
    browser = await chromium
      .launch({
        channel: "chrome",
        headless: true,
        args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
      })
      .catch(async () =>
        chromium.launch({
          headless: true,
          args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
        }),
      );
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.on("pageerror", (err) => console.error("[page]", err.message));
    page.on("download", async (d) => {
      const file = path.join(DOWNLOADS, d.suggestedFilename());
      await d.saveAs(file);
      console.log("parte salva:", d.suggestedFilename());
    });

    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      ["renderjob.current", JSON.stringify({ video: job.video, audioUrl: job.audioUrl, pexelsKey: PEXELS_API_KEY })],
    );
    await page.goto(`${APP_URL}/render-job`, { waitUntil: "domcontentloaded" });

    await page.waitForFunction(
      () => ["done", "error"].includes(localStorage.getItem("renderjob.status") || ""),
      null,
      { timeout: 300 * 60 * 1000, polling: 5000 },
    );
    const status = await page.evaluate(() => localStorage.getItem("renderjob.status"));
    if (status === "error") {
      const message = await page.evaluate(() => localStorage.getItem("renderjob.error") || "Erro na renderização.");
      console.error("render falhou:", message);
      await fail(job.video.id, message);
      return;
    }

    // aguarda os downloads serem salvos em disco
    const expectedRaw = await page.evaluate(() => localStorage.getItem("renderjob.parts"));
    const expected = Math.max(1, Number(expectedRaw) || 1);
    for (let i = 0; i < 120 && i < expected * 60; i++) {
      const saved = (await import("node:fs/promises")).readdir;
      const files = await saved(DOWNLOADS);
      if (files.length >= expected) break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    const files = (await (await import("node:fs/promises")).readdir(DOWNLOADS)).sort();
    if (files.length === 0) throw new Error("Nenhuma parte foi gerada.");

    const paths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const buf = await readFile(path.join(DOWNLOADS, files[i]));
      const storagePath = `${job.video.user_id}/out/${job.video.id}/parte-${String(i + 1).padStart(2, "0")}`;
      const { error } = await admin.storage
        .from("videos")
        .upload(storagePath, buf, { upsert: true, contentType: files[i].endsWith(".mp4") ? "video/mp4" : "video/webm" });
      if (error) throw new Error(`Falha no upload da parte ${i + 1}: ${error.message}`);
      paths.push(storagePath);
      console.log(`parte ${i + 1}/${files.length} enviada ao armazenamento`);
    }

    await complete(job.video.id, paths);
    console.log(`vídeo ${job.video.id} concluído com ${paths.length} parte(s).`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("renderOne:", message);
    await fail(job.video.id, message);
  } finally {
    await browser?.close();
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  await waitForApp();
  let processed = 0;
  for (;;) {
    if (Date.now() - startedAt > MAX_RUN_MS) {
      console.log("Tempo máximo da execução alcançado; o resto vai na próxima passagem.");
      break;
    }
    const job = await claim();
    if (!job) break;
    processed++;
    console.log(`Renderizando "${job.video.title}" (${job.video.id})…`);
    await renderOne(job);
  }
  console.log(`Fila concluída — ${processed} vídeo(s) processado(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
