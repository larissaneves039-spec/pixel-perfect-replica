# Corrigir o erro 404 do Gemini

## Causa
O erro da imagem é **404**, não de cota. 404 quer dizer "modelo não encontrado": o app pede sempre o modelo fixo `gemini-2.5-flash`. Esse modelo provavelmente foi aposentado ou não está disponível para a sua chave. Sua chave e sua cota não são o problema.

## Correção
1. Antes de analisar, o app pergunta ao Gemini quais modelos a sua chave pode usar e escolhe o mais recente da linha "Flash" que aceite áudio (gera conteúdo). Se não houver Flash, usa o Pro mais recente.
2. O modelo escolhido fica guardado neste navegador. Se um dia responder 404 de novo, o app procura outro uma única vez.
3. O botão "Testar chave" passa a mostrar qual modelo será usado.
4. As mensagens de erro mostram o motivo real que o Gemini enviou (ex.: "modelo não encontrado"), e não um texto genérico. O aviso de limite só aparece quando o Gemini realmente responder 429.

## Detalhes técnicos
- `src/lib/gemini.ts`: nova `pickModel(key)` que chama `GET /v1beta/models?pageSize=1000`, filtra os modelos com `supportedGenerationMethods` contendo `generateContent`, exclui variantes `tts`, `image`, `live`, `embedding` e `lite`, e prefere `flash` estável sobre `preview`, ordenando pela versão. O nome escolhido fica em `localStorage`.
- `call()` usa o modelo resolvido. Em 404: limpa o cache, escolhe de novo e tenta uma única vez. As mensagens incluem `error.message` do Google.
- Teste: `pickModel` escolhe o Flash estável mais novo a partir de uma lista de modelos de exemplo.
