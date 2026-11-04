// Servidor de arquivos estáticos para o worker do GitHub Actions.
// Serve o build de .output/public com fallback SPA (qualquer rota cai no
// index.html, que é o shell do app em modo SPA).
import { join, normalize } from "node:path";

const root = normalize(new URL("../.output/public", import.meta.url).pathname);
const port = Number(process.env["PORT"] || 4173);
// Prefixo opcional (ex.: BASE_PREFIX=/motion-mosaic) para simular o GitHub
// Pages, que serve o site sob /<nome-do-repo>/.
const basePrefix = (process.env["BASE_PREFIX"] || "").replace(/\/+$/, "");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain",
};

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);
    if (basePrefix) {
      if (pathname === basePrefix) pathname = "/";
      else if (pathname.startsWith(`${basePrefix}/`)) pathname = pathname.slice(basePrefix.length);
    }
    if (pathname.endsWith("/")) pathname += "index.html";
    const candidate = normalize(join(root, pathname));
    if (candidate.startsWith(root)) {
      const file = Bun.file(candidate);
      if (await file.exists()) {
        const ext = candidate.slice(candidate.lastIndexOf(".")).toLowerCase();
        return new Response(file, { headers: { "content-type": MIME[ext] ?? "application/octet-stream" } });
      }
    }
    // Fallback SPA: devolve o shell para qualquer rota desconhecida.
    return new Response(Bun.file(join(root, "index.html")), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
});

console.log(`App estático servido em http://localhost:${port}`);
