import { describe, expect, it } from "vitest";
import { planSlots, MAX_SLOTS } from "@/lib/slotPlanner";
import { pickVideoFile, type Media, type SearchParams } from "@/lib/pexelsClient";
import { resolveAll, resolveSlot, fillWithNeighbors } from "@/lib/mediaResolver";
import { buildQueries, detectEmotion } from "@/lib/queryBuilder";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe("planSlots", () => {
  it("60 s com 6 s por mídia gera 10 cenas somando 60", () => {
    const { slots } = planSlots(60, 6);
    expect(slots).toHaveLength(10);
    expect(sum(slots.map((s) => s.duration))).toBeCloseTo(60, 6);
  });
  it("125 s gera 21 cenas, nenhuma acima de 6 s", () => {
    const { slots } = planSlots(125, 6);
    expect(slots).toHaveLength(21);
    expect(Math.max(...slots.map((s) => s.duration))).toBeLessThanOrEqual(6);
    expect(sum(slots.map((s) => s.duration))).toBeCloseTo(125, 6);
  });
  it("respeita o teto de 600 cenas aumentando o tempo por mídia", () => {
    const r = planSlots(3 * 3600, 6);
    expect(r.slots.length).toBeLessThanOrEqual(MAX_SLOTS);
    expect(r.adjusted).toBe(true);
    expect(sum(r.slots.map((s) => s.duration))).toBeCloseTo(10800, 4);
  });
});

describe("pickVideoFile", () => {
  const files = [
    { file_type: "video/mp4", quality: "hd", width: 2560, height: 1440, link: "a" },
    { file_type: "video/mp4", quality: "hd", width: 1280, height: 720, link: "b" },
    { file_type: "video/mp4", quality: "hd", width: 1920, height: 1080, link: "c" },
    { file_type: "video/mp4", quality: "sd", width: 640, height: 360, link: "d" },
  ];
  it("Padrão escolhe o menor HD que atende a largura", () => expect(pickVideoFile(files, 1280, "standard")?.link).toBe("b"));
  it("Alta escolhe o primeiro ≥ 1920", () => expect(pickVideoFile(files, 1280, "high")?.link).toBe("c"));
});

function fakeSearcher(n: number, onlyGeneric = false) {
  let id = 0;
  const pages = new Map<string, Media[]>();
  return {
    rateLimited: false,
    calls: [] as string[],
    async search(p: SearchParams) {
      this.calls.push(p.query);
      if (onlyGeneric && !["cinematic atmosphere", "dramatic landscape", "abstract motion", "aerial city"].includes(p.query))
        return { items: [], hasMore: false };
      const k = `${p.type}|${p.query}|${p.page}`;
      if (!pages.has(k))
        pages.set(
          k,
          Array.from({ length: n }, () => {
            id++;
            return { key: `${p.type === "video" ? "v" : "p"}:${id}`, id, type: p.type, url: "u", thumbUrl: "t", width: 1920, height: 1080, duration: 10, authorName: "a", pexelsUrl: "x" } as Media;
          }),
        );
      return { items: pages.get(k)!, hasMore: false };
    },
  };
}

describe("resolveAll", () => {
  it("não repete nenhuma mídia", async () => {
    const { slots } = planSlots(600, 6);
    const used = new Set<string>();
    const res = await resolveAll({
      searcher: fakeSearcher(6),
      slots,
      queriesFor: (s) => buildQueries({ theme: "floresta sombria à noite", sectionText: "", tone: "dark", keywords: [], slotIndex: s.index, userLocale: "pt-BR" }),
      opts: { orientation: "landscape", mode: "video", photoPct: 0 },
      used,
    });
    const keys = res.filter((r) => !r.reused).map((r) => r.media!.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("usa a consulta genérica quando as demais não retornam nada", async () => {
    const s = fakeSearcher(3, true);
    const m = await resolveSlot(s, buildQueries({ theme: "xyz qwe", sectionText: "", tone: "cinematic", keywords: [], slotIndex: 0, userLocale: "pt-BR" }), { orientation: "landscape", mode: "video", photoPct: 0 }, new Set());
    expect(m).not.toBeNull();
  });
  it("reaproveita a vizinha anterior e falha sem nenhuma cena", () => {
    const { slots } = planSlots(18, 6);
    const media = { key: "v:1" } as Media;
    const out = fillWithNeighbors([
      { slot: slots[0], media, effect: "zoom-in", reused: false },
      { slot: slots[1], media: null, effect: "zoom-out", reused: false },
      { slot: slots[2], media: null, effect: "pan-left", reused: false },
    ]);
    expect(out[1].reused).toBe(true);
    expect(out[1].media?.key).toBe("v:1");
    expect(() => fillWithNeighbors([{ slot: slots[0], media: null, effect: "zoom-in", reused: false }])).toThrow();
  });
});

describe("detectEmotion", () => {
  it("detecta medo em texto pt", () => expect(detectEmotion("o medo da floresta")).toBe("fear"));
  it("palavras curtas só contam inteiras", () => expect(detectEmotion("software")).toBeNull());
});
