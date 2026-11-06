import { DEFAULT_TONE } from "./tables";

export type Format = "16:9" | "9:16" | "1:1";
export interface SectionInput {
  description: string;
  weight: number;
  keywords?: string[];
}
export interface FormState {
  hours: number;
  minutes: number;
  seconds: number;
  format: Format;
  maxMedia: number;
  theme: string;
  tone: string;
  keywords: string[];
  locale: "pt-BR" | "en-US";
  mode: "video" | "photo" | "mixed";
  photoPct: number;
  quality: "standard" | "high";
  sections: SectionInput[];
  crossfade: number;
  scanlines: boolean;
  bitrate: 5 | 8 | 12;
  partMinutes: 0 | 5 | 10 | 20 | 30;
  includeAudio: boolean;
  subtitles: boolean;
  captions: import("./captions").Caption[];
}

export const DEFAULT_FORM: FormState = {
  hours: 0,
  minutes: 1,
  seconds: 0,
  format: "16:9",
  maxMedia: 6,
  theme: "",
  tone: DEFAULT_TONE,
  keywords: [],
  locale: "pt-BR",
  mode: "video",
  photoPct: 30,
  quality: "standard",
  sections: [],
  crossfade: 0.5,
  scanlines: false,
  bitrate: 8,
  partMinutes: 20,
  includeAudio: true,
  subtitles: false,
  captions: [],
};

export const FORMAT_SIZE: Record<Format, { w: number; h: number; orientation: "landscape" | "portrait"; minWidth: number }> = {
  "16:9": { w: 1920, h: 1080, orientation: "landscape", minWidth: 1280 },
  "9:16": { w: 1080, h: 1920, orientation: "portrait", minWidth: 720 },
  "1:1": { w: 1080, h: 1080, orientation: "landscape", minWidth: 1280 },
};

export const totalSeconds = (f: FormState) => (f.hours || 0) * 3600 + (f.minutes || 0) * 60 + (f.seconds || 0);
export const MIN_TOTAL = 10;
export const MAX_TOTAL = 3 * 3600;

const FORM_KEY = "bgvideo.form.v1";
const KEY_KEY = "bgvideo.pexelsKey";

export function loadForm(): FormState {
  try {
    const raw = localStorage.getItem(FORM_KEY);
    if (raw) return { ...DEFAULT_FORM, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_FORM;
}
export function saveForm(f: FormState) {
  try {
    localStorage.setItem(FORM_KEY, JSON.stringify(f));
  } catch {
    /* ignore */
  }
}
export function loadKey(): string {
  try {
    return localStorage.getItem(KEY_KEY) ?? "";
  } catch {
    return "";
  }
}
export function saveKey(k: string) {
  try {
    localStorage.setItem(KEY_KEY, k);
  } catch {
    /* ignore */
  }
}

export function fmtTime(s: number): string {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
}

const GKEY = "bgvideo.geminiKey";
export function loadGeminiKey(): string {
  try { return localStorage.getItem(GKEY) ?? ""; } catch { return ""; }
}
export function saveGeminiKey(k: string) {
  try { localStorage.setItem(GKEY, k); } catch { /* ignore */ }
}
