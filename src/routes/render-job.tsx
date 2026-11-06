import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { PexelsClient } from "@/lib/pexelsClient";
import type { Media } from "@/lib/pexelsClient";
import { blockedTermsFor } from "@/lib/contentFilter";
import { resolveSlot } from "@/lib/mediaResolver";
import { buildQueries } from "@/lib/queryBuilder";
import { renderVideo, type Scene, type RenderPart, type RenderProgress } from "@/lib/renderer";
import { partCountFor, partFileName, type StoredScene, type StoredSettings } from "@/lib/queue";

// Página usada pelo worker do GitHub Actions: recebe o trabalho pela
// localStorage (gravada pelo script), renderiza e baixa cada parte.
// Não é usada por pessoas: exige localStorage preenchida pelo worker.

interface RenderJob {
  video: {
    id: string;
    title: string;
    user_id: string;
    total_seconds: number;
    scenes: StoredScene[];
    settings: StoredSettings;
  };
  audioUrl: string | null;
  pexelsKey: string;
}

export const LS_JOB = "renderjob.current";
export const LS_STATUS = "renderjob.status";
export const LS_ERROR = "renderjob.error";
export const LS_PARTS = "renderjob.parts";
export const LS_PROGRESS = "renderjob.progress";

export const Route = createFileRoute("/render-job")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Renderizando vídeo — Gerador de Vídeo de Fundo" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RenderJobPage,
});

function RenderJobPage() {
  const [phase, setPhase] = useState("Preparando…");
  const [msg, setMsg] = useState("");
  const [pct, setPct] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    const run = async () => {
      try {
        const raw = localStorage.getItem(LS_JOB);
        if (!raw) throw new Error("Nenhum trabalho na fila.");
        const job = JSON.parse(raw) as RenderJob;
        const s = job.video.settings;
        localStorage.setItem(LS_STATUS, "rendering");
        localStorage.setItem(LS_PARTS, String(partCountFor(job.video.total_seconds, s.partSeconds)));

        setPhase("Carregando áudio…");
        let audio: Blob | null = null;
        if (s.includeAudio && job.audioUrl) {
          try {
            audio = await (await fetch(job.audioUrl, { signal: ctrl.signal })).blob();
          } catch {
            audio = null; // segue sem áudio
          }
        }

        const scenes: Scene[] = job.video.scenes.map((sc, i) => {
          if (!sc.media) throw new Error(`Cena ${i + 1} sem mídia.`);
          return {
            start: sc.start,
            duration: sc.duration,
            media: sc.media as Media,
            effect: sc.effect as Scene["effect"],
          };
        });

        const used = new Set<string>(scenes.map((sc) => sc.media!.key));
        const client = job.pexelsKey
          ? new PexelsClient(job.pexelsKey, s.minWidth, s.quality, () => {})
          : null;
        const opts = { orientation: s.orientation, mode: s.mode, photoPct: 0, blockedTerms: blockedTermsFor(s.theme) };

        const canvas = canvasRef.current;
        if (!canvas) throw new Error("Canvas indisponível.");
        setPhase("Renderizando…");
        await renderVideo({
          canvas,
          width: s.w,
          height: s.h,
          total: s.total || job.video.total_seconds,
          scenes,
          ...(client
            ? {
                replaceVideo: async (blocked: Media, i: number) => {
                  used.add(blocked.key);
                  const q = buildQueries({
                    theme: s.theme,
                    sectionText: "",
                    sectionKeywords: undefined,
                    tone: s.tone,
                    keywords: [],
                    slotIndex: i,
                    userLocale: s.locale,
                  });
                  return resolveSlot(client, q, { ...opts, videoOnly: true }, used, new Set([blocked.key]));
                },
              }
            : {}),
          onVideoReplaced: () => {},
          audio,
          crossfade: s.crossfade,
          scanlines: s.scanlines,
          captions: s.captions,
          bitrateMbps: s.bitrateMbps,
          partSeconds: s.partSeconds ?? null,
          onProgress: (p: RenderProgress) => {
            localStorage.setItem(LS_PROGRESS, JSON.stringify(p));
            setPct((p.elapsed / p.total) * 100);
            setPhase(`Renderizando · parte ${p.part + 1}/${p.parts} · cena ${p.sceneIndex + 1}`);
          },
          onPart: (p: RenderPart) => {
            const url = URL.createObjectURL(p.blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = partFileName(p.index, p.ext);
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            setMsg(`Parte ${p.index + 1} pronta.`);
          },
          signal: ctrl.signal,
        });
        if (cancelled) return;
        localStorage.setItem(LS_STATUS, "done");
        setPhase("Concluído.");
        setPct(100);
      } catch (e) {
        if (cancelled || ctrl.signal.aborted) return;
        localStorage.setItem(LS_STATUS, "error");
        localStorage.setItem(LS_ERROR, e instanceof Error ? e.message : "Erro na renderização.");
        setPhase("Erro.");
        setMsg(e instanceof Error ? e.message : "Erro na renderização.");
      }
    };

    void run();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="panel w-full max-w-2xl space-y-4 p-6">
        <h1 className="text-lg font-semibold">Renderizando vídeo</h1>
        <canvas ref={canvasRef} className="mx-auto max-h-[50vh] max-w-full rounded-md border border-border bg-background" />
        <Progress value={pct} />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>{phase} {msg && `· ${msg}`}</span>
        </div>
      </div>
    </div>
  );
}
