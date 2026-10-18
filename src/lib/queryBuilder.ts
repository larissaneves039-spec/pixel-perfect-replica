import { EMOTION_KEYWORDS, EMOTION_VISUALS, GENERIC_QUERIES, toneModifiers } from "./tables";

export interface Query {
  q: string;
  locale: string;
}

export function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function detectEmotion(text: string): string | null {
  const norm = normalize(text);
  const words = new Set(norm.split(/[^a-z0-9]+/).filter(Boolean));
  let best: string | null = null;
  let bestScore = 0;
  for (const [emotion, kws] of EMOTION_KEYWORDS) {
    let score = 0;
    for (const kw of kws) {
      const k = normalize(kw);
      if (k.length <= 3 ? words.has(k) : norm.includes(k)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = emotion;
    }
  }
  return best;
}

const STOP = new Set(
  "the and for with from into over under of to in on at by uma uns umas das dos nas nos pela pelo pelas pelos para com sem sob sobre que como mas por entre ate the".split(
    " ",
  ),
);

export function relevantWords(theme: string): string[] {
  return theme
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter((w) => w.length > 2 && !STOP.has(normalize(w)));
}

export function shortTheme(theme: string): string {
  return relevantWords(theme).slice(0, 3).join(" ");
}

export interface SectionQueries {
  variants: Query[];
  firstVisual: Query | null;
  niche: Query | null;
  generic: Query;
}

export function buildQueries(opts: {
  theme: string;
  sectionText: string;
  tone: string;
  keywords: string[];
  slotIndex: number;
  userLocale: string;
  random?: () => number;
}): SectionQueries {
  const { theme, sectionText, tone, keywords, slotIndex, userLocale } = opts;
  const rnd = opts.random ?? Math.random;
  const text = `${theme} ${sectionText}`.trim();
  const emotion = detectEmotion(text);
  const mods = toneModifiers(tone);
  const visuals = emotion ? EMOTION_VISUALS[emotion] : [];
  const short = shortTheme(theme) || theme.trim();
  const mod = (i: number) => mods[(slotIndex + i) % mods.length];
  const out: Query[] = [];
  const seen = new Set<string>();
  const push = (q: string, locale: string) => {
    const k = q.trim().toLowerCase();
    if (!k || seen.has(k) || out.length >= 8) return;
    seen.add(k);
    out.push({ q: q.trim(), locale });
  };
  keywords.forEach((kw, i) => push(`${kw} ${mod(i)}`, userLocale));
  if (short) push(`${short} ${mod(0)}`, userLocale);
  for (let i = 0; i < Math.min(5, visuals.length * mods.length); i++) {
    const v = visuals[(slotIndex + i) % visuals.length];
    push(`${v} ${mod(i + 1)}`, "en-US");
  }
  if (short) push(short, userLocale);
  const nicheWords = relevantWords(theme).slice(0, 2).join(" ");
  return {
    variants: out,
    firstVisual: visuals[0] ? { q: visuals[0], locale: "en-US" } : null,
    niche: nicheWords ? { q: nicheWords, locale: userLocale } : null,
    generic: { q: GENERIC_QUERIES[Math.floor(rnd() * GENERIC_QUERIES.length)], locale: "en-US" },
  };
}
