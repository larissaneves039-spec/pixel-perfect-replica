import { describe, expect, it } from "vitest";
import { blockedTermsFor, hasBlockedTerm } from "@/lib/contentFilter";

describe("filtro de conteúdo cristão", () => {
  it("tema cristão bloqueia outras religiões e bruxaria", () => {
    const b = blockedTermsFor("louvor cristão");
    expect(hasBlockedTerm("https://www.pexels.com/video/buddhist-monk-praying-123/", b)).toBe(true);
    expect(hasBlockedTerm("https://www.pexels.com/photo/witch-hat-candles-9/", b)).toBe(true);
    expect(hasBlockedTerm("https://www.pexels.com/video/rosary-in-hands-5/", b)).toBe(true);
    expect(hasBlockedTerm("https://www.pexels.com/video/sunrise-over-mountains-7/", b)).toBe(false);
  });
  it("tema não religioso não bloqueia nada", () => {
    expect(blockedTermsFor("viagem pela cidade")).toEqual([]);
  });
});
