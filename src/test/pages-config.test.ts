import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Supabase no GitHub Pages", () => {
  for (const workflow of ["deploy-pages.yml", "render.yml"]) {
    it(`${workflow} fornece uma chave pública quando o secret não existe`, () => {
      const contents = readFileSync(`.github/workflows/${workflow}`, "utf8");
      const fallback = contents.match(/VITE_SUPABASE_PUBLISHABLE_KEY: \$\{\{ secrets\.VITE_SUPABASE_PUBLISHABLE_KEY \|\| '([^']+)' \}\}/)?.[1];
      const missingSecret = "";
      expect(missingSecret || fallback).toBe("sb_publishable_n7r9vp6Mboox7BncKStXnA_HyxtHMcj");
    });
  }
});