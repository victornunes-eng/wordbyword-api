# Word by Word · API

API de vocabulário em inglês desenvolvida para o trabalho de **Front-end Engineering — FIAP**. Expõe cinco palavras com explicação em português e exemplo em inglês, mantendo o contrato do BFF apresentado em aula.

## Integrantes

| Integrante | RM |
| --- | --- |
| Victor Santana Nunes da Silva | 369361 |
| Marjorie Nunes Ribeiro | 366725 |

## Tecnologias e arquitetura

- Node.js 22.13 ou superior, JavaScript e módulos ESM.
- Servidor HTTP nativo do Node.js, sem dependências de runtime.
- OpenAI Responses API com saída estruturada por JSON Schema.
- Vercel para publicação. A configuração do Render também está disponível.
- Testes com `node:test`.

Fluxo: **React → GET /ask → API própria → OpenAI → validação → array JSON**.
A chave fica exclusivamente nas variáveis do servidor. Ela nunca é enviada ao frontend ou incluída no Git.

## Executar localmente

```bash
npm ci
cp .env.example .env
# Edite .env para inserir sua OPENAI_API_KEY.
npm run dev
```

A API responde em `http://localhost:3001`. O endpoint de palavras é `http://localhost:3001/ask`.

Para desenvolvimento sem consumo da OpenAI, configure explicitamente `WORD_PROVIDER=demo`. Esse modo retorna cinco exemplos fixos, informa `X-Word-Provider: demo` e não representa geração por IA. Em produção, utilize `WORD_PROVIDER=openai`. Falhas da OpenAI não são substituídas silenciosamente por exemplos.

## Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `PORT` | Porta local, padrão 3001. A hospedagem pode fornecer seu próprio valor. |
| `WORD_PROVIDER` | `openai` (padrão) ou `demo` para desenvolvimento. |
| `OPENAI_API_KEY` | Chave secreta com acesso e saldo na API. Obrigatória no modo OpenAI. |
| `OPENAI_MODEL` | Modelo compatível com Responses e Structured Outputs; padrão `gpt-4o-mini`. |
| `ALLOWED_ORIGINS` | Origens permitidas pelo CORS, separadas por vírgulas, sem barra final. |
| `TRUST_PROXY` | `1` somente quando a plataforma possui um proxy confiável que define `X-Forwarded-For`; caso contrário, `0`. |

## Contrato HTTP

### `GET /ask`

Retorna HTTP 200 e **um array de cinco objetos**, cada um com `word`, `description` e `useCase`. Exemplo de um objeto:

```json
{
  "word": "curiosity",
  "description": "Curiosidade: vontade de aprender e entender algo novo.",
  "useCase": "Her curiosity led her to learn a new language."
}
```

| Código | Significado |
| --- | --- |
| 200 | Palavras retornadas e validadas. |
| 403 | Origem não permitida pelo CORS. |
| 404 | Rota inexistente. |
| 405 | Método não permitido. |
| 429 | Limite de 10 consultas por minuto por IP atingido. |
| 502 | Falha, timeout ou resposta inválida do provedor. |
| 503 | Configuração ausente ou capacidade local esgotada. |

### `GET /health`

Retorna o estado do processo, o modo do provedor e se a chave foi configurada, **sem revelar a chave**. Esse endpoint não faz uma consulta paga e não comprova saldo ou disponibilidade da OpenAI.

## Publicar na Vercel

1. Importe este repositório como projeto na Vercel. As funções estão em `api/ask.js` e `api/health.js`; `vercel.json` mapeia as rotas públicas.
2. Configure Node.js 22.x e as variáveis `OPENAI_API_KEY`, `WORD_PROVIDER=openai`, `OPENAI_MODEL=gpt-4o-mini`, `ALLOWED_ORIGINS` com a URL pública do frontend e `TRUST_PROXY=1`.
3. Publique em produção e confira `/health` e `/ask` sem estar autenticado na Vercel.
4. No frontend, configure `NEXT_PUBLIC_API_URL` com a URL completa terminada em `/ask` e refaça sua compilação/publicação.

Pela CLI, após `npx vercel login`, use `npx vercel --prod`. Cadastre segredos pelo painel ou por `vercel env add`; não os passe em argumentos de comando nem em arquivos versionados. Uma alteração de ambiente exige novo deploy.

Alternativa: importe `render.yaml` como Blueprint no Render, configure os valores solicitados e confira a URL gerada. Em planos com suspensão por inatividade, a primeira consulta pode demorar mais.

## Testes

```bash
npm test
```

Os testes cobrem contrato HTTP, CORS, preflight, credencial ausente, limite de requisições, recuperação de falhas, cache, concorrência, validação, resposta estruturada, recusas e rotas inválidas. O provedor é simulado nos testes automatizados: eles não geram cobranças e não comprovam a integração real. A validação de produção deve consultar `/ask` com a chave configurada.

## Decisões e limites

- Timeout de 45 segundos para a OpenAI.
- Cache de 15 segundos para evitar consultas pagas repetidas em sequência. Durante esse intervalo, uma nova busca pode retornar as mesmas palavras.
- Consultas simultâneas compartilham a chamada em andamento na mesma instância.
- Cache e limite por IP são **locais à instância**, não distribuídos. Em serverless, diferentes instâncias podem processar o mesmo IP. Para maior escala, adotar armazenamento compartilhado e limite global de consumo.
- CORS restringe navegadores, mas não substitui autenticação nem limita clientes HTTP externos. Esta API é pública para a avaliação.
- Os significados e exemplos são gerados por IA e podem conter imprecisões.

## Referências

Implementação própria, inspirada no contrato e na proposta didática do [BFF de Jaison Schmidt](https://github.com/jaisonschmidt/fiap-bff). Não foi copiado código do repositório.

- [OpenAI — Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Vercel — Node.js Runtime](https://vercel.com/docs/functions/runtimes/node-js)
