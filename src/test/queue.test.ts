import { describe, expect, it } from "vitest";
import { buildScenes, buildSettings, partCountFor, partFileName, creditsText } from "@/lib/queue";
import { DEFAULT_FORM, type FormState } from "@/lib/formState";
import type { ResolvedSlot } from "@/lib/mediaResolver";
import type { Slot } from "@/lib/slotPlanner";
import type { Media } from "@/lib/pexelsClient";

const slot = (startTime: number, duration: number, index = 0): Slot => ({
  index,
  sectionIndex: 0,
  slotInSection: index,
  startTime,
  duration,
  effect: "zoom-in",
});

const media: Media = {
  key: "pexels-video-1",
  id: 1,
  type: "video",
  url: "https://example.com/v.mp4",
  thumbUrl: "https://example.com/t.jpg",
  width: 1920,
  height: 1080,
  duration: 12,
  authorName: "Autor",
  pexelsUrl: "https://www.pexels.com/video/1",
};

describe("partCountFor", () => {
  it("divide 1 h em partes de 20 min", () => {
    expect(partCountFor(3600, 1200)).toBe(3);
  });

  it("sem divisão gera uma única parte", () => {
    expect(partCountFor(3600, null)).toBe(1);
    expect(partCountFor(3600, 7200)).toBe(1);
  });

  it("duração exatamente divisível não gera parte extra", () => {
    expect(partCountFor(120, 60)).toBe(2);
  });

  it("resto gera parte final menor", () => {
    expect(partCountFor(125, 60)).toBe(3);
  });
});

describe("partFileName", () => {
  it("numera as partes com dois dígitos", () => {
    expect(partFileName(0, "mp4")).toBe("parte-01.mp4");
    expect(partFileName(11, "webm")).toBe("parte-12.webm");
  });
});

describe("buildScenes", () => {
  it("serializa slot + mídia + efeito", () => {
    const slots: ResolvedSlot[] = [{ slot: slot(0, 6), media, effect: "zoom-in", reused: false }];
    const scenes = buildScenes(slots);
    expect(scenes).toHaveLength(1);
    expect(scenes[0]).toMatchObject({ start: 0, duration: 6, effect: "zoom-in" });
    expect(scenes[0].media.key).toBe(media.key);
    expect(scenes[0].media.pexelsUrl).toBe(media.pexelsUrl);
  });

  it("recusa cena sem mídia", () => {
    const slots: ResolvedSlot[] = [{ slot: slot(0, 6), media: null, effect: "zoom-in", reused: false }];
    expect(() => buildScenes(slots)).toThrow();
  });
});

describe("buildSettings", () => {
  it("reflete o formulário padrão", () => {
    const s = buildSettings(DEFAULT_FORM, 60);
    expect(s.w).toBe(1920);
    expect(s.h).toBe(1080);
    expect(s.orientation).toBe("landscape");
    expect(s.partSeconds).toBe(1200);
    expect(s.crossfade).toBe(0.5);
    expect(s.bitrateMbps).toBe(8);
    expect(s.includeAudio).toBe(true);
  });

  it("respeita formato vertical e divisão desligada", () => {
    const form: FormState = { ...DEFAULT_FORM, format: "9:16", partMinutes: 0 };
    const s = buildSettings(form, 60);
    expect(s.orientation).toBe("portrait");
    expect(s.partSeconds).toBeNull();
  });
});

describe("creditsText", () => {
  it("lista autor e link do Pexels de cada cena", () => {
    const text = creditsText([{ start: 0, duration: 6, media, effect: "zoom-in" }]);
    expect(text).toContain("Pexels");
    expect(text).toContain("Autor");
    expect(text).toContain(media.pexelsUrl);
  });
});
