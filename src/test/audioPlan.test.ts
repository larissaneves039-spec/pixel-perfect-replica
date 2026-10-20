import { describe, expect, it } from "vitest";
import { sectionsFromAnalysis } from "@/lib/gemini";
import { buildQueries } from "@/lib/queryBuilder";

describe("seções a partir do áudio", () => {
  it("pesos proporcionais aos tempos e cobrindo toda a duração", () => {
    const s = sectionsFromAnalysis([
      { start: 30, end: 120, description: "b", keywords: ["city"] },
      { start: 0, end: 30, description: "a", keywords: ["ocean"] },
    ], 120);
    expect(s.map((x) => x.description)).toEqual(["a", "b"]);
    expect(s.map((x) => x.weight)).toEqual([25, 75]);
  });
  it("palavras-chave da seção vêm antes das gerais", () => {
    const q = buildQueries({ theme: "mar", sectionText: "", tone: "cinematic", keywords: ["geral"], sectionKeywords: ["ocean waves"], slotIndex: 0, userLocale: "pt-BR", random: () => 0 });
    expect(q.variants[0].q).toBe("ocean waves");
  });
});
