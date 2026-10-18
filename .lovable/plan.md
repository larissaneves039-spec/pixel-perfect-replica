# Gerador de Vídeo de Fundo (Pexels)

Implementar exatamente a especificação enviada: app 100% no navegador, tema escuro, em pt-BR, sem login, banco de dados ou IA.

## O que o usuário verá
1. **Tela principal (/)**: formulário completo (duração com atalhos, formato, tempo máximo por mídia com "≈ N cenas", tema, tom visual agrupado por categoria, palavras-chave em chips, idioma, tipo de mídia com slider "% de fotos", qualidade, seção Avançado). Salvo automaticamente no navegador.
2. **Configurações**: diálogo para colar a chave do Pexels, com "Testar chave" e "Obter chave grátis".
3. **Revisão**: linha do tempo + grade de cards (miniatura, intervalo, selo Clipe/Foto/Reaproveitada, autor), com "Trocar esta mídia", "Gerar nova seleção", "Completar cenas faltantes" e resumo (cenas, tipos, requisições usadas).
4. **Renderização**: progresso em tempo real, aviso para manter a aba visível, botão Cancelar, partes separadas quando o vídeo é longo.
5. **Resultado**: pré-visualização, "Baixar vídeo", "Baixar créditos (.txt)", um botão por parte + "Baixar todas". Rodapé fixo "Mídias fornecidas por Pexels".

## Ordem de construção
1. Tabelas do Anexo A + planejamento de cenas (`planSlots`) + testes.
2. Cliente Pexels (cache, paginação, timeouts, erros 401/403/429) + montagem de consultas + resolução de cenas sem repetição e com reaproveitamento da vizinha + tela de revisão.
3. Render no canvas (Ken Burns, crossfade, carregamento sob demanda, pausa ao trocar de aba, partes, correção de duração WebM) + download.
4. (Opcional, por último) modo rápido para fotos.

## Detalhes técnicos
- Lógica pura em `src/lib/`: `tables.ts`, `slotPlanner.ts`, `queryBuilder.ts`, `pexelsClient.ts`, `mediaResolver.ts`, `renderer.ts`; UI em `src/components/` (Form, SettingsDialog, ReviewGrid, Timeline, RenderPanel, ResultPanel).
- Uma única rota `/` com etapas internas (formulário → revisão → render → resultado); head() com título/descrição próprios.
- Chave só em `localStorage` (try/catch); todas as chamadas com `AbortController` e timeouts da seção 3.2.
- Dependência: `fix-webm-duration`. Tema escuro via tokens em `src/styles.css`; fontes distintas carregadas no `__root`.
- Testes vitest: soma das durações = total e cada cena ≤ máximo (60 s → 10 cenas; 125 s → 21), teto de 600, nenhuma key repetida, cadeia de fallback, escolha do arquivo HD.
- Verificação final com Playwright do formulário e da tela de revisão (com chave real só se o usuário fornecer).
