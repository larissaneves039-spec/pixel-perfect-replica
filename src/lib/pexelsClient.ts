export type MediaType = "video" | "photo";
export type Orientation = "landscape" | "portrait";

export interface Media {
  key: string;
  id: number;
  type: MediaType;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  duration?: number;
  authorName: string;
  pexelsUrl: string;
  alt?: string;
}

export type PexelsErrorKind = "auth" | "rate" | "timeout" | "network" | "http";

export class PexelsError extends Error {
  constructor(
    public kind: PexelsErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export const ERROR_MESSAGES: Record<PexelsErrorKind, string> = {
  auth: "Chave do Pexels inválida.",
  rate: "Limite da API do Pexels atingido (padrão: 200 req/hora e 20.000/mês).",
  timeout: "O Pexels demorou demais para responder.",
  network: "Falha de rede ao acessar o Pexels.",
  http: "O Pexels respondeu com erro.",
};

export async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (ctrl.signal.aborted) throw new PexelsError("timeout", ERROR_MESSAGES.timeout);
    throw new PexelsError("network", ERROR_MESSAGES.network);
  } finally {
    clearTimeout(timer);
  }
}

export interface VideoFile {
  file_type: string;
  quality: string | null;
  width: number;
  height: number;
  link: string;
}

export function pickVideoFile(files: VideoFile[], minWidth: number, quality: "standard" | "high"): VideoFile | undefined {
  const ok = files
    .filter((f) => f.file_type === "video/mp4" && f.quality === "hd" && f.width >= minWidth)
    .sort((a, b) => a.width - b.width);
  if (!ok.length) return files[0];
  if (quality === "standard") return ok[0];
  return ok.find((f) => f.width >= 1920) ?? ok[ok.length - 1];
}

export interface SearchPage {
  items: Media[];
  hasMore: boolean;
}

export interface SearchParams {
  type: MediaType;
  query: string;
  orientation: Orientation;
  locale: string;
  page: number;
  useSize: boolean;
}

export async function testKey(key: string): Promise<void> {
  const r = await fetchWithTimeout(
    "https://api.pexels.com/v1/search?query=nature&per_page=1",
    { headers: { Authorization: key } },
    12000,
  );
  if (r.status === 401 || r.status === 403) throw new PexelsError("auth", ERROR_MESSAGES.auth);
  if (r.status === 429) throw new PexelsError("rate", ERROR_MESSAGES.rate);
  if (!r.ok) throw new PexelsError("http", `${ERROR_MESSAGES.http} (${r.status})`);
}

export class PexelsClient {
  requests = 0;
  rateLimited = false;
  private cache = new Map<string, Promise<SearchPage>>();
  constructor(
    private key: string,
    private minWidth: number,
    private quality: "standard" | "high",
    private onRequest?: (n: number) => void,
  ) {}

  search(p: SearchParams): Promise<SearchPage> {
    const ck = [p.type, p.query.toLowerCase(), p.orientation, p.useSize ? "m" : "-", p.locale, p.page].join("|");
    const hit = this.cache.get(ck);
    if (hit) return hit;
    if (this.rateLimited) return Promise.reject(new PexelsError("rate", ERROR_MESSAGES.rate));
    const pr = this.doSearch(p);
    this.cache.set(ck, pr);
    pr.catch(() => this.cache.delete(ck));
    return pr;
  }

  private async doSearch(p: SearchParams): Promise<SearchPage> {
    const base = p.type === "video" ? "https://api.pexels.com/v1/videos/search" : "https://api.pexels.com/v1/search";
    const qs = new URLSearchParams({
      query: p.query,
      orientation: p.orientation,
      per_page: "40",
      page: String(p.page),
      locale: p.locale,
    });
    if (p.useSize) qs.set("size", "medium");
    this.requests++;
    this.onRequest?.(this.requests);
    const r = await fetchWithTimeout(`${base}?${qs}`, { headers: { Authorization: this.key } }, 12000);
    if (r.status === 401 || r.status === 403) throw new PexelsError("auth", ERROR_MESSAGES.auth);
    if (r.status === 429) {
      this.rateLimited = true;
      throw new PexelsError("rate", ERROR_MESSAGES.rate);
    }
    if (!r.ok) throw new PexelsError("http", `${ERROR_MESSAGES.http} (${r.status})`);
    const data = await r.json();
    const hasMore = !!data.next_page || (data.total_results ?? 0) > p.page * 40;
    if (p.type === "video") {
      const items: Media[] = (data.videos ?? []).map((v: any) => {
        const f = pickVideoFile(v.video_files ?? [], this.minWidth, this.quality);
        return {
          key: "v:" + v.id,
          id: v.id,
          type: "video",
          url: f?.link ?? "",
          thumbUrl: v.image,
          width: f?.width ?? v.width,
          height: f?.height ?? v.height,
          duration: v.duration,
          authorName: v.user?.name ?? "Pexels",
          pexelsUrl: v.url,
        } satisfies Media;
      });
      return { items: items.filter((m) => m.url), hasMore };
    }
    const items: Media[] = (data.photos ?? []).map((ph: any) => ({
      key: "p:" + ph.id,
      id: ph.id,
      type: "photo",
      url: ph.src?.large2x || ph.src?.large || ph.src?.original,
      thumbUrl: ph.src?.medium,
      width: ph.width,
      height: ph.height,
      authorName: ph.photographer ?? "Pexels",
      pexelsUrl: ph.url,
      alt: ph.alt ?? "",
    }));
    return { items, hasMore };
  }
}
