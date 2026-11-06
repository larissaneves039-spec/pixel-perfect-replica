export interface Caption {
  start: number;
  end: number;
  text: string;
}

export function cleanCaptions(list: Caption[], total: number): Caption[] {
  const out = list
    .filter((c) => c && typeof c.text === "string" && c.text.trim() && Number.isFinite(c.start) && Number.isFinite(c.end))
    .map((c) => ({ start: Math.max(0, c.start), end: Math.min(total, c.end), text: c.text.trim() }))
    .filter((c) => c.end > c.start)
    .sort((a, b) => a.start - b.start);
  for (let i = 0; i < out.length - 1; i++) if (out[i].end > out[i + 1].start) out[i].end = out[i + 1].start;
  return out.filter((c) => c.end > c.start);
}

export function captionAt(list: Caption[], t: number): Caption | null {
  let lo = 0, hi = list.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = list[mid];
    if (t < c.start) hi = mid - 1;
    else if (t >= c.end) lo = mid + 1;
    else return c;
  }
  return null;
}

export function wrapCaption(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && measure(next) > maxWidth) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}
