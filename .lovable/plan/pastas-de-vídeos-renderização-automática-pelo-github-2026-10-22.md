# Pastas de vídeos + renderização automática pelo GitHub

## Resposta curta: precisa de armazenamento?
Sim. O GitHub não consegue ver o que está no seu navegador. Para ele saber quais vídeos faltam renderizar e para guardar os vídeos prontos, precisa de um lugar comum: um banco com a lista de vídeos e um espaço de arquivos para os vídeos. Vamos usar o Supabase, como você escolheu.

## O que você verá
1. **Pastas ("caixas")**: uma nova página "Meus vídeos" com pastas que você cria, renomeia e apaga (ex.: "Meditação", "Podcast"). Cada vídeo fica em uma pasta, com miniatura, duração, data e situação: **Na fila**, **Renderizando**, **Pronto**, **Erro**.
2. **Na tela de revisão**, além de "Renderizar agora", um botão novo **"Enviar para a fila"**: escolhe a pasta e salva a seleção de cenas (e o áudio, se houver) sem renderizar no navegador.
3. **Vídeos prontos** aparecem na pasta com prévia, "Baixar vídeo" e "Baixar créditos". Vídeos renderizados no navegador também podem ser salvos numa pasta.
4. **Automático**: a cada 20 minutos o GitHub pega os vídeos "Na fila", renderiza e envia o resultado para a pasta. Se falhar, o vídeo fica como "Erro" com o motivo e um botão "Tentar de novo".

## Passo a passo para conectar o Supabase (você faz depois que eu montar)
1. Crie uma conta em supabase.com e um projeto novo (guarde a senha do banco).
2. No Lovable: **Configurações do projeto → General → External Supabase → Connect**, entre na sua conta e escolha esse projeto.
3. Eu crio as tabelas e o espaço de arquivos automaticamente depois de conectado.
4. No Supabase, em **Project Settings → API**, copie a **Project URL** e a chave **service_role** (secreta).
5. No GitHub: repositório → **Settings → Secrets and variables → Actions → New secret**, crie:
   - `SUPABASE_URL` (a Project URL)
   - `SUPABASE_SERVICE_ROLE_KEY` (a chave secreta)
   - `PEXELS_API_KEY` (sua chave do Pexels, caso um clipe bloqueado precise ser trocado)
6. No GitHub, aba **Actions**, ative os workflows. Pronto: roda sozinho a cada 20 min (também dá para rodar na hora com "Run workflow").

## Login
Para proteger seus vídeos, o app passa a ter entrada com e-mail e senha; cada pessoa só vê suas pastas.

## Limites importantes
- A renderização é em tempo real: um vídeo de 1 h leva ~1 h. O GitHub permite até 6 h por execução; vídeos mais longos são feitos em partes.
- Repositório privado no GitHub tem 2.000 min/mês grátis de Actions; público é ilimitado.
- Plano grátis do Supabase guarda 1 GB de arquivos e cada arquivo até 50 MB: vídeos longos ou em alta qualidade podem exigir plano pago ou dividir em partes (a opção "partes" já existe).
- O GitHub pode atrasar o horário do cron alguns minutos.

## Detalhes técnicos
- Tabelas: `folders` (id, user_id, name), `videos` (id, user_id, folder_id, title, status queued|rendering|done|error, error, settings jsonb com formato/bitrate/crossfade, scenes jsonb com mídias resolvidas, audio_path, output_paths, total_seconds, locked_at, timestamps). RLS por `user_id`; bucket privado `videos` com caminhos `user_id/...`; URLs assinadas para prévia/download.
- Fila: o worker reivindica um vídeo com `update ... set status='rendering', locked_at=now() where status='queued'` (ou `rendering` travado há > 7 h), um por vez.
- Worker: `.github/workflows/render.yml` com `schedule: '*/20 * * * *'` + `workflow_dispatch`, `concurrency` para não sobrepor, timeout 350 min. Instala deps, faz `vite build` + `vite preview`, e um script `scripts/render-worker.ts` (Playwright/Chromium headless com `--autoplay-policy=no-user-gesture-required` e H.264 via Chrome do canal estável) abre a rota oculta `/render-job`, que reaproveita `renderVideo` existente; o blob resultante é enviado ao Storage pelo próprio script.
- Página nova `/videos` (pastas) e `/auth`; rotas protegidas sob `_authenticated`.
- Memória: atualizar a regra "app sem backend" em AGENTS.md, já que agora há Supabase e GitHub Actions; chaves do Gemini/Pexels continuam no navegador para uso manual.
- Testes: reivindicação da fila não pega o mesmo vídeo duas vezes; vídeo travado volta para a fila; status muda para done/error.
