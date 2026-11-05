import { describe, expect, it } from "vitest";
import { authEmailRedirect } from "@/lib/authRedirect";

describe("Endereço de confirmação de e-mail", () => {
  it("retorna à página inicial dentro do repositório no GitHub Pages", () => {
    expect(authEmailRedirect("https://larissaneves039-spec.github.io", "/pixel-perfect-replica/"))
      .toBe("https://larissaneves039-spec.github.io/pixel-perfect-replica/");
  });
  it("retorna à página inicial quando o app está na raiz", () => {
    expect(authEmailRedirect("http://localhost:8080", "/")).toBe("http://localhost:8080/");
  });
});