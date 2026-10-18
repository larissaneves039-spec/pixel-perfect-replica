import fixWebmDuration from "fix-webm-duration";
import type { Media } from "./pexelsClient";
import type { Effect } from "./slotPlanner";

export interface Scene {
  start: number;
  duration: number;
  media: Media;
  effect: Effect;
}

export interface RenderPart {
  index: number;
  start: number;
  end: number;
  blob: Blob;
  mime: string;
  ext: "mp4" | "webm";
}

export interface RenderProgress {
  elapsed: number; // segundos globais
  total: number;
  sceneIndex: number;
  part: number;
  parts: number;
}

export interface RenderOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  scenes: Scene[];
  total: number;
  crossfade: number;
  scanlines: boolean;
  bitrateMbps: number;
  partSeconds: number | null;
  onProgress?: (p: RenderProgress) => void;
  onPart?: (p: RenderPart) => void;
  signal: AbortSignal;
}

const MIME_ORDER = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

export function supportCheck(): string | null {
  if (typeof window === "undefined") return null;
  if (typeof MediaRecorder === "undefined") return "Seu navegador não suporta MediaRecorder. Use Chrome ou Edge no computador.";
  const c = document.createElement("canvas");
  if (typeof (c as any).captureStream !== "function") return "Seu navegador não suporta captureStream. Use Chrome ou Edge no computador.";
  if (!pickMime()) return "Nenhum formato de vídeo suportado pelo MediaRecorder.";
  return null;
}

export function pickMime(): string | null {
  for (const m of MIME_ORDER) if (MediaRecorder.isTypeSupported(m)) return m;
  return null;
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function kenBurns(effect: Effect, p: number): { scale: number; dx: number } {
  const e = easeInOutCubic(Math.min(1, Math.max(0, p)));
  switch (effect) {
    case "zoom-in":
      return { scale: 1 + 0.1 * e, dx: 0 };
    case "zoom-out":
      return { scale: 1.1 - 0.1 * e, dx: 0 };
    case "pan-right":
      return { scale: 1.06, dx: -0.03 + 0.06 * e };
    case "pan-left":
      return { scale: 1.06, dx: 0.03 - 0.06 * e };
    case "zoom-in-fast":
      return { scale: 1 + 0.2 * e, dx: 0 };
  }
}

type Loaded =
  | { kind: "video"; el: HTMLVideoElement; url: string; thumb: ImageBitmap | null }
  | { kind: "image"; bmp: ImageBitmap }
  | { kind: "failed" };

async function fetchBlob(url: string, ms: number): Promise<Blob> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.blob();
  } finally {
    clearTimeout(t);
  }
}

async function loadBitmap(url: string): Promise<ImageBitmap> {
  return createImageBitmap(await fetchBlob(url, 30000));
}

async function loadScene(m: Media): Promise<Loaded> {
  if (m.type === "photo") {
    try {
      return { kind: "image", bmp: await loadBitmap(m.url) };
    } catch {
      try {
        return { kind: "image", bmp: await loadBitmap(m.thumbUrl) };
      } catch {
        return { kind: "failed" };
      }
    }
  }
  const thumbP = loadBitmap(m.thumbUrl).catch(() => null);
  try {
    const blob = await fetchBlob(m.url, 90000);
    const url = URL.createObjectURL(blob);
    const el = document.createElement("video");
    el.muted = true;
    el.playsInline = true;
    el.loop = true;
    el.preload = "auto";
    el.src = url;
    return { kind: "video", el, url, thumb: await thumbP };
  } catch {
    const thumb = await thumbP;
    return thumb ? { kind: "image", bmp: thumb } : { kind: "failed" };
  }
}

function release(l: Loaded) {
  if (l.kind === "video") {
    l.el.pause();
    l.el.removeAttribute("src");
    l.el.load();
    URL.revokeObjectURL(l.url);
    l.thumb?.close();
  } else if (l.kind === "image") l.bmp.close();
}

function drawCover(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, W: number, H: number, scale = 1, dx = 0) {
  if (!sw || !sh) return;
  const s = Math.max(W / sw, H / sh) * scale;
  const w = sw * s;
  const h = sh * s;
  ctx.drawImage(src, (W - w) / 2 + dx * W, (H - h) / 2, w, h);
}

export async function renderVideo(o: RenderOptions): Promise<RenderPart[]> {
  const { canvas, width: W, height: H, scenes, total, signal } = o;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const mime = pickMime();
  if (!mime) throw new Error("Formato de vídeo não suportado.");
  const ext: "mp4" | "webm" = mime.includes("mp4") ? "mp4" : "webm";
  const stream = canvas.captureStream(30);
  const scanPattern = (() => {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 4;
    const cx = c.getContext("2d")!;
    cx.fillStyle = "#000";
    cx.fillRect(0, 0, 1, 1);
    return ctx.createPattern(c, "repeat");
  })();

  const loaded = new Map<number, Promise<Loaded>>();
  const ready = new Map<number, Loaded>();
  const ensure = (i: number) => {
    if (i < 0 || i >= scenes.length || loaded.has(i)) return;
    const p = loadScene(scenes[i].media);
    loaded.set(i, p);
    p.then((l) => {
      if (loaded.get(i) === p) ready.set(i, l);
      else release(l);
    });
  };
  const keepWindow = (cur: number, keepPrev: boolean) => {
    for (let i = cur; i <= cur + 2; i++) ensure(i);
    for (const [i, p] of [...loaded]) {
      if (i > cur + 2 || i < cur - 1 || (i === cur - 1 && !keepPrev)) {
        loaded.delete(i);
        const l = ready.get(i);
        ready.delete(i);
        if (l) release(l);
        else p.then(release);
      }
    }
  };
  const sceneAt = (t: number) => {
    let lo = 0,
      hi = scenes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (scenes[mid].start <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const drawScene = (i: number, t: number, alpha: number) => {
    let l = ready.get(i);
    let idx = i;
    if (!l || l.kind === "failed") {
      // vizinha já carregada
      for (const j of [i - 1, i + 1, i - 2, i + 2]) {
        const n = ready.get(j);
        if (n && n.kind !== "failed") {
          l = n;
          idx = j;
          break;
        }
      }
    }
    if (!l || l.kind === "failed") return;
    const sc = scenes[i];
    const p = (t - sc.start) / sc.duration;
    ctx.globalAlpha = alpha;
    if (l.kind === "video" && l.el.readyState >= 2) {
      ctx.filter = "none";
      drawCover(ctx, l.el, l.el.videoWidth, l.el.videoHeight, W, H);
    } else {
      const bmp = l.kind === "video" ? l.thumb : l.bmp;
      if (bmp) {
        const kb = kenBurns(scenes[idx === i ? i : i].effect, p);
        ctx.filter = "saturate(110%) contrast(1.03)";
        drawCover(ctx, bmp, bmp.width, bmp.height, W, H, kb.scale, kb.dx);
      }
    }
    ctx.filter = "none";
    ctx.globalAlpha = 1;
  };

  const partLen = o.partSeconds && o.partSeconds < total ? o.partSeconds : total;
  const partCount = Math.max(1, Math.ceil(total / partLen - 1e-9));
  const parts: RenderPart[] = [];

  for (let part = 0; part < partCount; part++) {
    if (signal.aborted) break;
    const pStart = part * partLen;
    const pEnd = Math.min(total, pStart + partLen);
    const pDur = pEnd - pStart;
    // pré-carrega o início da parte
    const first = sceneAt(pStart);
    keepWindow(first, false);
    await Promise.race([
      Promise.all([first, first + 1].filter((i) => loaded.has(i)).map((i) => loaded.get(i))),
      new Promise((r) => setTimeout(r, 30000)),
    ]);

    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: o.bitrateMbps * 1_000_000 });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise<void>((r) => (rec.onstop = () => r()));

    let elapsed = 0;
    let last = performance.now();
    let current = -1;
    let hidden = document.hidden;
    const playing = new Set<HTMLVideoElement>();

    const onVis = () => {
      if (document.hidden) {
        hidden = true;
        if (rec.state === "recording") rec.pause();
        playing.forEach((v) => v.pause());
      } else {
        hidden = false;
        last = performance.now();
        if (rec.state === "paused") rec.resume();
        playing.forEach((v) => v.play().catch(() => {}));
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const frame = (t: number) => {
      const i = sceneAt(t);
      const sc = scenes[i];
      const inFade = i > 0 && t - sc.start < o.crossfade;
      if (i !== current) {
        current = i;
        keepWindow(i, true);
      } else if (!inFade) keepWindow(i, false);
      // controle de reprodução dos clipes
      const want = new Set<HTMLVideoElement>();
      for (const j of inFade ? [i - 1, i] : [i]) {
        const l = ready.get(j);
        if (l?.kind === "video") want.add(l.el);
      }
      playing.forEach((v) => {
        if (!want.has(v)) {
          v.pause();
          playing.delete(v);
        }
      });
      want.forEach((v) => {
        if (!playing.has(v)) {
          playing.add(v);
          v.currentTime = 0;
          if (!hidden) v.play().catch(() => {});
        }
      });
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, W, H);
      if (inFade) {
        drawScene(i - 1, t, 1);
        drawScene(i, t, (t - sc.start) / o.crossfade);
      } else drawScene(i, t, 1);
      if (o.scanlines && scanPattern) {
        ctx.globalAlpha = 0.04;
        ctx.fillStyle = scanPattern;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    };

    frame(pStart);
    rec.start(1000);
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (signal.aborted) return resolve();
        const now = performance.now();
        if (!hidden) {
          elapsed += Math.min(0.1, (now - last) / 1000);
          if (elapsed >= pDur) return resolve();
          frame(pStart + elapsed);
          o.onProgress?.({ elapsed: pStart + elapsed, total, sceneIndex: current, part, parts: partCount });
        }
        last = now;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      // fallback se rAF for estrangulado
    });
    document.removeEventListener("visibilitychange", onVis);
    playing.forEach((v) => v.pause());
    if (rec.state !== "inactive") rec.stop();
    await stopped;
    if (signal.aborted) break;
    let blob = new Blob(chunks, { type: mime.split(";")[0] });
    chunks.length = 0;
    if (ext === "webm") {
      try {
        blob = await fixWebmDuration(blob, pDur * 1000, { logger: false });
      } catch {
        /* mantém o original */
      }
    }
    const rp: RenderPart = { index: part, start: pStart, end: pEnd, blob, mime, ext };
    parts.push(rp);
    o.onPart?.(rp);
  }

  for (const [i] of loaded) {
    const l = ready.get(i);
    if (l) release(l);
  }
  stream.getTracks().forEach((t) => t.stop());
  return parts;
}
