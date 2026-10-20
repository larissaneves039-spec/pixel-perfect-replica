# Áudio + Gemini para montar o vídeo automaticamente

## O que muda para você
1. **Configurações** ganha um segundo campo: "Chave da API do Gemini" (salva só neste navegador, com botão "Testar chave"), igual à do Pexels.
2. No formulário aparece uma área **"Enviar áudio"** (MP3, WAV, M4A, OGG, até ~20 MB).
3. Ao enviar, o app:
   - lê a duração do áudio e preenche horas/minutos/segundos automaticamente (campos ficam travados enquanto houver áudio);
   - envia o áudio ao Gemini, que escuta, entende o assunto e devolve:
     - tema geral, tom e palavras-chave;
     - uma divisão em **seções na ordem do áudio** (ex.: 0:00–0:45 "introdução sobre o oceano"), cada uma com descrição e palavras-chave em inglês para busca no Pexels.
4. Tudo isso preenche o formulário; você pode revisar e editar antes de gerar.
5. A busca no Pexels usa as palavras-chave de cada seção, então as imagens acompanham o que está sendo falado/tocado naquele momento.
6. Opção **"Incluir o áudio no vídeo final"** (ligada por padrão): o vídeo exportado sai com o áudio enviado sincronizado. Desligada, sai sem som como hoje.

## Detalhes técnicos
- `formState`: novo `geminiKey` (localStorage), `audio` (nome/duração, arquivo mantido em memória), `includeAudio`, e seções com `start/end` + `keywords` próprios.
- `src/lib/audio.ts`: obtém duração via `HTMLAudioElement`/`decodeAudioData`.
- `src/lib/geminiClient.ts`: chamada direta do navegador a `generativelanguage.googleapis.com` (`gemini-2.5-flash`), áudio inline em base64 (ou File API para arquivos grandes), resposta em JSON estruturado (`responseSchema`). Erros 400/403/429 mostrados em português; sem repetição automática além de 1 nova tentativa com espera em 429.
- `slotPlanner`: pesos das seções calculados pelos tempos devolvidos pelo Gemini (normalizados para a duração exata do áudio).
- `queryBuilder`: palavras-chave da seção têm prioridade sobre as globais.
- `renderer`: quando `includeAudio`, conecta o áudio via `AudioContext` → `MediaStreamDestination` e adiciona a faixa ao `MediaRecorder`, iniciando junto com o primeiro quadro; em vídeos divididos em partes, o áudio continua contínuo entre as partes.
- `GeneratorForm`: componente de upload, estado "Analisando áudio…", resumo do que o Gemini entendeu.
- Testes: distribuição de pesos a partir dos tempos das seções; duração do vídeo = duração do áudio; prioridade das palavras-chave da seção.
