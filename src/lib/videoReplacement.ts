import type { Media } from "./pexelsClient";

/** Mantém a cena como vídeo e limita tentativas de arquivos indisponíveis. */
export async function loadVideoWithReplacement<T>(options: {
  media: Media;
  load: (media: Media) => Promise<T>;
  replace?: ((blocked: Media) => Promise<Media | null>) | undefined;
  signal: AbortSignal;
}): Promise<{ media: Media; loaded: T }> {
  let media = options.media;
  const tried = new Set<string>();
  for (let attempt = 0; attempt < 6; attempt++) {
    options.signal.throwIfAborted();
    tried.add(media.key);
    try {
      const loaded = await options.load(media);
      return { media, loaded };
    } catch {
      options.signal.throwIfAborted();
      if (attempt === 5) break;
      const next = await options.replace?.(media);
      if (!next || next.type !== "video" || tried.has(next.key)) break;
      media = next;
    }
  }
  throw new Error("Não foi possível substituir um clipe bloqueado por outro vídeo. Tente gerar uma nova seleção ou tente mais tarde.");
}