import { describe, it, expect } from "vitest";
import { captionAt, cleanCaptions, wrapCaption } from "@/lib/captions";

describe("legendas", () => {
  const caps = cleanCaptions([{ start: 3, end: 6, text: "b" }, { start: 0, end: 3.5, text: "a" }, { start: 8, end: 99, text: "c" }], 10);
  it("ordena, remove sobreposição e limita à duração", () => {
    expect(caps).toEqual([{ start: 0, end: 3, text: "a" }, { start: 3, end: 6, text: "b" }, { start: 8, end: 10, text: "c" }]);
  });
  it("mostra a legenda do momento certo", () => {
    expect(captionAt(caps, 4)?.text).toBe("b");
    expect(captionAt(caps, 7)).toBeNull();
  });
  it("quebra linhas longas", () => {
    expect(wrapCaption("um dois tres", 7, (s) => s.length)).toEqual(["um dois", "tres"]);
  });
});
