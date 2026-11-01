# Roadmap

- [x] Tabelas `folders`/`videos`, função de fila e RLS no Supabase
- [x] Bucket privado `videos` com regras por usuário
- [x] Login por e-mail/senha (`/auth`) e rotas protegidas
- [x] Página "Meus vídeos" com pastas, prévia, download, reenfileirar e apagar
- [x] Botão "Enviar para a fila" na revisão e "Salvar na pasta" no resultado
- [x] Rotas do worker (`/api/public/worker/claim|complete|fail`) com WORKER_SECRET
- [x] Página `/render-job` + `scripts/render-worker.ts` + `.github/workflows/render.yml`
- [ ] Usuária: criar os secrets no GitHub (SUPABASE_URL, SUPUBASE_SERVICE_ROLE_KEY, WORKER_SECRET, PEXELS_API_KEY) e ativar o workflow
  - Aguarda ação fora do app (GitHub): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WORKER_SECRET, PEXELS_API_KEY
- [ ] Usuária: ativar o provedor de e-mail/senha no Supabase (Authentication → Providers), se ainda não estiver ativo
