import type { Media, MediaType, Orientation, SearchPage, SearchParams } from "./pexelsClient";
import { PexelsError } from "./pexelsClient";
import type { Query, SectionQueries } from "./queryBuilder";
import { nextEffect, type Effect, type Slot } from "./slotPlanner";

export interface Searcher {
  search(p: SearchParams): Promise<SearchPage>;
  rateLimited: boolean;
}

export type MediaMode = "video" | "photo" | "mixed";

export interface ResolveOptions {
  orientation: Orientation;
  mode: MediaMode;
  photoPct: number;
  random?: () => number;
  chainTimeoutMs?: number;
  slotTimeoutMs?: number;
  videoOnly?: boolean;
}

export interface ResolvedSlot {
  slot: Slot;
  media: Media | null;
  effect: Effect;
  reused: boolean;
}

export type SlotOrigin = "clipe" | "foto" | "reaproveitada" | "falha";

function typeOrder(opts: ResolveOptions, rnd: () => number): MediaType[] {
  if (opts.videoOnly) return ["video"];
  if (opts.mode === "photo") return ["photo"];
  if (opts.mode === "video") return ["video", "photo"];
  return rnd() * 100 < opts.photoPct ? ["photo", "video"] : ["video", "photo"];
}

function usable(m: Media, relaxed: boolean): boolean {
  if (m.type === "photo") return true;
  const d = m.duration ?? 0;
  return d >= 5 && d <= (relaxed ? 60 : 30);
}

/** Busca candidatos não usados de uma consulta, paginando até 3 páginas. */
async function fromQuery(
  s: Searcher,
  q: Query,
  type: MediaType,
  opts: ResolveOptions,
  used: Set<string>,
  exclude: Set<string>,
  relaxed: boolean,
): Promise<Media[]> {
  for (let page = 1; page <= 3; page++) {
    const res = await s.search({ type, query: q.q, orientation: opts.orientation, locale: q.locale, page, useSize: !relaxed });
    const c = res.items.filter((m) => usable(m, relaxed) && !used.has(m.key) && !exclude.has(m.key));
    if (c.length || !res.hasMore) return c;
  }
  return [];
}

export function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Resolve uma cena. Erros de autenticação propagam; o resto vira "sem resultado". */
export async function resolveSlot(
  s: Searcher,
  queries: SectionQueries,
  opts: ResolveOptions,
  used: Set<string>,
  exclude: Set<string> = new Set(),
): Promise<Media | null> {
  const rnd = opts.random ?? Math.random;
  const started = Date.now();
  const chainMs = opts.chainTimeoutMs ?? 20000;
  const types = typeOrder(opts, rnd);
  const pool = new Map<string, Media>();
  let stop = false;

  const run = async (q: Query | null, relaxed: boolean) => {
    if (!q || stop) return;
    if (Date.now() - started > chainMs) {
      stop = true;
      return;
    }
    for (const t of types) {
      try {
        const c = await fromQuery(s, q, t, opts, used, exclude, relaxed);
        c.forEach((m) => pool.set(m.key, m));
        if (c.length) return;
      } catch (e) {
        if (e instanceof PexelsError && e.kind === "auth") throw e;
        if (e instanceof PexelsError && e.kind === "rate") {
          stop = true;
          return;
        }
      }
    }
  };

  const chain = async (relaxed: boolean) => {
    for (const v of queries.variants) {
      if (pool.size >= 5 || stop) break;
      await run(v, relaxed);
    }
    if (pool.size < 3) await run(queries.firstVisual, relaxed);
    if (pool.size < 3) await run(queries.niche, relaxed);
    if (pool.size < 2) await run(queries.generic, relaxed);
  };

  await chain(false);
  if (pool.size === 0 && !stop) await chain(true);

  const cands = shuffle(
    [...pool.values()].filter((m) => !used.has(m.key) && !exclude.has(m.key)),
    rnd,
  );
  if (!cands.length) return null;
  const pick = cands[Math.floor(rnd() * Math.min(3, cands.length))];
  used.add(pick.key); // síncrono: dedupe garantido entre workers
  return pick;
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Preenche cenas vazias com a vizinha resolvida mais próxima (empate: anterior). */
export function fillWithNeighbors(results: ResolvedSlot[]): ResolvedSlot[] {
  const own = results.map((r) => (r.media && !r.reused ? r.media : null));
  if (!own.some(Boolean)) throw new Error("Pexels indisponível ou chave inválida: nenhuma cena pôde ser resolvida.");
  return results.map((r, i) => {
    if (r.media && !r.reused) return r;
    for (let d = 1; d < results.length; d++) {
      const prev = i - d >= 0 ? own[i - d] : null;
      if (prev) return { ...r, media: prev, reused: true, effect: nextEffect(results[i - d].effect) };
      const next = i + d < results.length ? own[i + d] : null;
      if (next) return { ...r, media: next, reused: true, effect: nextEffect(results[i + d].effect) };
    }
    return r;
  });
}

export async function resolveAll(params: {
  searcher: Searcher;
  slots: Slot[];
  queriesFor: (slot: Slot) => SectionQueries;
  opts: ResolveOptions;
  used: Set<string>;
  existing?: ResolvedSlot[] | undefined;
  onSlotResolved?: (done: number, total: number, origin: SlotOrigin, index: number) => void;
  concurrency?: number;
}): Promise<ResolvedSlot[]> {
  const { searcher, slots, queriesFor, opts, used, existing, onSlotResolved } = params;
  const results: ResolvedSlot[] = slots.map((slot, i) => {
    const ex = existing?.[i];
    if (ex && ex.media && !ex.reused) return ex;
    return { slot, media: null, effect: slot.effect, reused: false };
  });
  const todo = results.map((r, i) => (r.media ? -1 : i)).filter((i) => i >= 0);
  let cursor = 0;
  let done = results.length - todo.length;
  let fatal: unknown = null;
  const worker = async () => {
    while (cursor < todo.length && !fatal) {
      const i = todo[cursor++];
      try {
        const m = await withTimeout(
          resolveSlot(searcher, queriesFor(slots[i]), opts, used),
          opts.slotTimeoutMs ?? 90000,
          null,
        );
        results[i] = { ...results[i], media: m };
        done++;
        onSlotResolved?.(done, results.length, m ? (m.type === "video" ? "clipe" : "foto") : "falha", i);
      } catch (e) {
        fatal = e;
      }
    }
  };
  await Promise.all(Array.from({ length: params.concurrency ?? 3 }, worker));
  if (fatal) throw fatal;
  return fillWithNeighbors(results);
}
