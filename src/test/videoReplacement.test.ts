import { describe, expect, it } from "vitest";
import { loadVideoWithReplacement } from "@/lib/videoReplacement";
import { resolveSlot } from "@/lib/mediaResolver";
import { buildQueries } from "@/lib/queryBuilder";
import type { Media, SearchParams } from "@/lib/pexelsClient";

const video = (id: number): Media => ({ key: `v:${id}`, id, type: "video", url: "clip", thumbUrl: "cover", width: 1920, height: 1080, duration: 10, authorName: "Autor", pexelsUrl: "pexels" });

describe("clipes bloqueados", () => {
  it("substitui o vídeo bloqueado por outro vídeo reproduzível", async () => {
    const attempts: number[] = [];
    const result = await loadVideoWithReplacement({
      media: video(1), signal: new AbortController().signal,
      load: async (m) => { attempts.push(m.id); if (m.id === 1) throw new Error("403"); return "vídeo carregado"; },
      replace: async () => video(2),
    });
    expect(attempts).toEqual([1, 2]);
    expect(result.media.key).toBe("v:2");
    expect(result.loaded).toBe("vídeo carregado");
  });
  it("não aceita foto como substituta", async () => {
    await expect(loadVideoWithReplacement({ media: video(1), signal: new AbortController().signal,
      load: async () => { throw new Error("403"); }, replace: async () => ({ ...video(2), type: "photo" }),
    })).rejects.toThrow("outro vídeo");
  });
  it("busca apenas vídeos sem recorrer a fotos", async () => {
    const types: string[] = [];
    const result = await resolveSlot({ rateLimited: false, search: async (p: SearchParams) => {
      types.push(p.type); return { items: [], hasMore: false };
    } }, buildQueries({ theme: "natureza", sectionText: "", tone: "cinematic", keywords: [], slotIndex: 0, userLocale: "pt-BR" }),
    { orientation: "landscape", mode: "mixed", photoPct: 100, videoOnly: true }, new Set());
    expect(result).toBeNull();
    expect(types.length).toBeGreaterThan(0);
    expect(new Set(types)).toEqual(new Set(["video"]));
  });
});