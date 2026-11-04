// Regra do projeto: o app roda em hospedagem estática (GitHub Pages), sem
// servidor próprio. Nenhum módulo do app pode depender de código de servidor
// (server functions ou rotas em src/routes/api) — o acesso ao banco é direto
// do navegador, protegido pelas policies de RLS do Supabase.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx|js|jsx)$/.test(entry) ? [full] : [];
  });
}

describe("app sem dependência de servidor", () => {
  it("nenhum arquivo usa createServerFn", () => {
    const offenders = walk(SRC).filter((f) => readFileSync(f, "utf8").includes("createServerFn"));
    expect(offenders, `encontrados: ${offenders.join(", ")}`).toEqual([]);
  });

  it("não existe rota de servidor em src/routes/api", () => {
    expect(existsSync(path.join(SRC, "routes", "api"))).toBe(false);
  });
});
