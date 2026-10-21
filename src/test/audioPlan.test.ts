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

import { audioMime } from "@/lib/gemini";
describe("tipo de áudio", () => {
  it("arquivo .mp4 é enviado como audio/mp4", () => {
    expect(audioMime(new File([""], "voz.mp4", { type: "video/mp4" }))).toBe("audio/mp4");
  });
});

import { chooseModel } from "@/lib/gemini";
describe("escolha do modelo Gemini", () => {
  it("prefere o Flash estável mais novo", () => {
    const g = ["generateContent"];
    expect(chooseModel([
      { name: "models/gemini-2.0-flash", supportedGenerationMethods: g },
      { name: "models/gemini-3-flash", supportedGenerationMethods: g },
      { name: "models/gemini-3.5-flash-preview", supportedGenerationMethods: g },
      { name: "models/gemini-3-pro", supportedGenerationMethods: g },
      { name: "models/gemini-3-flash-tts", supportedGenerationMethods: g },
      { name: "models/gemini-embedding-2", supportedGenerationMethods: ["embedContent"] },
    ])).toBe("gemini-3-flash");
  });
});
