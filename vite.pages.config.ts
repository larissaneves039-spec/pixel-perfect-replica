// Build de destino para hospedagem estática (GitHub Pages).
// O app roda 100% no navegador (Supabase direto pelo client + RLS), então o
// build aqui gera só arquivos estáticos: shell SPA em index.html + assets.
// Uso: PAGES_BASE_PATH=/repo/ vite build -c vite.pages.config.ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const base = process.env["PAGES_BASE_PATH"]?.replace(/\/+$/, "") || "";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    spa: { enabled: true, prerender: { outputPath: "/index.html" } },
  },
  vite: { base: base ? `${base}/` : "/" },
});
