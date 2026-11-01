import type { ResolvedSlot } from "./mediaResolver";
import type { Media } from "./pexelsClient";
import { FORMAT_SIZE, type FormState } from "./formState";
import type { MediaMode } from "./mediaResolver";

/** Cena serializada na fila (JSON no banco). */
export interface StoredScene {
  start: number;
  duration: number;
  media: Media;
  effect: string;
}

/** Ajustes de renderização serializados na fila (JSON no banco). */
export interface StoredSettings {
  w: number;
  h: number;
  orientation: "landscape" | "portrait";
  minWidth: number;
  total: number;
  crossfade: number;
  scanlines: boolean;
  bitrateMbps: number;
  partSeconds: number | null;
  includeAudio: boolean;
  theme: string;
  tone: string;
  locale: "pt-BR" | "en-US";
  mode: MediaMode;
  photoPct: number;
  quality: "standard" | "high";
}

export function buildScenes(slots: ResolvedSlot[]): StoredScene[] {
  return slots.map((s) => {
    if (!s.media) throw new Error("Há uma cena sem mídia.");
    return {
      start: s.slot.startTime,
      duration: s.slot.duration,
      media: s.media,
      effect: s.effect,
    };
  });
}

export function buildSettings(form: FormState, total: number): StoredSettings {
  const fmt = FORMAT_SIZE[form.format];
  return {
    w: fmt.w,
    h: fmt.h,
    orientation: fmt.orientation,
    minWidth: fmt.minWidth,
    total,
    crossfade: form.crossfade,
    scanlines: form.scanlines,
    bitrateMbps: form.bitrate,
    partSeconds: form.partMinutes ? form.partMinutes * 60 : null,
    includeAudio: form.includeAudio,
    theme: form.theme,
    tone: form.tone,
    locale: form.locale,
    mode: form.mode,
    photoPct: form.photoPct,
    quality: form.quality,
  };
}

/** Quantas partes a renderização vai gerar (mesma conta do renderer). */
export function partCountFor(total: number, partSeconds: number | null): number {
  const len = partSeconds && partSeconds < total ? partSeconds : total;
  return Math.max(1, Math.ceil(total / len - 1e-9));
}

/** Nome dos arquivos de saída, igual ao usado no navegador. */
export function partFileName(index: number, ext: string): string {
  return `parte-${String(index + 1).padStart(2, "0")}.${ext}`;
}

/** Gera o texto de créditos a partir das cenas salvas. */
export function creditsText(scenes: StoredScene[]): string {
  const fmt = (s: number) => {
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const p = (n: number) => String(n).padStart(2, "0");
    return h ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
  };
  const lines = scenes.map(
    (s) =>
      `${fmt(s.start)}–${fmt(s.start + s.duration)} | ${s.media.type === "video" ? "Clipe" : "Foto"} | ${s.media.authorName} | ${s.media.pexelsUrl}`,
  );
  return `Créditos — Mídias fornecidas por Pexels (https://www.pexels.com)\n\n${lines.join("\n")}\n`;
}
