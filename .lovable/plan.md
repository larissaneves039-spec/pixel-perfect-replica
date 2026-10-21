# Lidar com o Gemini "sobrecarregado" (erro 503)

## O que aconteceu
Agora sua chave **está funcionando**: o bloqueio de antes sumiu. O erro novo (503) não tem a ver com a sua cota nem com a chave. O Google respondeu "este modelo está com muita procura agora". Isso acontece do lado deles, com todos os usuários do mesmo modelo, e costuma passar em minutos.

O app desistia na primeira resposta assim. Vou fazer ele insistir sozinho e, se preciso, trocar de modelo.

## Correção
1. Quando o Gemini responder 503 ou 500 (sobrecarga), o app espera um pouco e tenta de novo, até 3 vezes (cerca de 2 s, 5 s e 10 s), mostrando "Gemini ocupado, tentando de novo…".
2. Se continuar sobrecarregado, o app passa para o próximo modelo disponível na sua chave (outro Flash, depois Pro) e tenta mais uma vez.
3. Se tudo falhar, a mensagem fica clara: "Os servidores do Gemini estão sobrecarregados agora (não é problema da sua chave nem da sua cota). Tente novamente em alguns minutos."
4. O aviso "limite de uso" continua só para o erro 429 real.

## Detalhes técnicos
- `src/lib/gemini.ts`: `chooseModel` passa a devolver a lista ordenada (`rankModels`). O cache guarda a lista. `call()` faz backoff com jitter em 500/503 (3 tentativas), depois avança para o próximo modelo da lista (no máximo 2 modelos extras). 404 continua renovando a lista uma vez. 400/401/403 continuam terminais, sem nova tentativa.
- Retorno de progresso opcional (`onStatus`) para o formulário mostrar "tentando de novo".
- Testes: `rankModels` com a ordem esperada, e um teste com `fetch` falso: 503, 503, 503 no primeiro modelo e depois 200 no segundo, conferindo que muda de modelo.
