# Roadmap

- [x] Tabelas `folders`/`videos`, função de fila e RLS no Supabase
- [x] Bucket privado `videos` com regras por usuário
- [x] Login por e-mail/senha (`/auth`) e rotas protegidas
- [x] Página "Meus vídeos" com pastas, prévia, download, reenfileirar e apagar
- [x] Botão "Enviar para a fila" na revisão e "Salvar na pasta" no resultado
- [x] Página `/render-job` + `scripts/render-worker.ts` + `.github/workflows/render.yml`
- [x] Acesso ao banco direto do navegador (RLS) — sem server functions; app roda em site estático
- [x] Worker do Actions fala direto com o Supabase (service role), sem rotas de servidor
- [x] Workflow `deploy-pages.yml` publicando o build estático no GitHub Pages
- [x] Corrigir publicação sem secret da chave pública: workflows usam a chave pública do projeto como alternativa
- [ ] Usuária: sincronizar a correção e executar novamente a publicação no GitHub Actions
  - Aguarda ação fora do app (GitHub). A chave pública não precisa de secret; SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e PEXELS_API_KEY continuam necessários ao worker. WORKER_SECRET não é mais necessário.
- [ ] Usuária: adicionar a URL final do GitHub Pages em Authentication → URL Configuration → Redirect URLs no Supabase
- [ ] Usuária: ativar o provedor de e-mail/senha no Supabase (Authentication → Providers), se ainda não estiver ativo
