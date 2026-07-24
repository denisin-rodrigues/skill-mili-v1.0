# A-011 — QAAndEvidence

**Propósito**: validar rotas, estados, animações, mídia, recursos, console, rede e
comportamento offline — e produzir evidências.

**Quando atuar**: fase 7, sobre o servidor local.

```bash
node scripts/validate.js --config mirror.config.yaml
node scripts/validate.js --config mirror.config.yaml --offline
```

## Categorias de teste no MVP

- **Boot local** — servidor sobe e rotas do contrato respondem.
- **Rotas** — todas as rotas declaradas, em todos os viewports.
- **Console** — erros coletados; erros de rede para origens bloqueadas pela allowlist são
  classificados como **esperados** (dependências externas documentadas), não como defeitos do mirror.
- **Network** — requisições locais falhas e **404 de arquivos locais** (missing) contados por rota.
- **Scroll** — exercitado em cada rota durante a validação.
- **Mídia/byte-range** — maior asset responde **206** com `Content-Range`.
- **Desktop + Mobile** — viewports do escopo, com screenshot por combinação.
- **Offline** (`--offline`) — nova sessão, rede externa bloqueada no contexto do navegador;
  toda tentativa externa é registrada. Não vale "testar offline depois de já ter carregado
  recursos externos": o contexto nasce bloqueado.

## Pós-MVP

Comparação visual origem × local, traces, HAR sanitizado, vídeo de validação, Service Worker
isolado, cache limpo vs aquecido, hover/click, préloader, áudio, WebGL.

## Classificação resultante

| Nível | Regra (MVP) |
|-------|-------------|
| L0 | nenhuma rota responde |
| L1 | alguma rota responde, mas há falhas/ausências |
| L2 | todas as rotas 200, zero 404 local, zero falha local |
| L3 | L2 + zero erros inesperados de console/pageerror |
| L4 | execução `--offline` atingindo pelo menos L2 |

## Saídas

- `capture/validation-results.json` (por rota/viewport + totais + classificação + razões)
- `capture/screenshots/local-*[-offline].png`
- `capture/logs/server-missing.log`

## Critérios de aceite

- [ ] `validation-results.json` declara nível e razões (sem falsa completude).
- [ ] Estados não exercitados constam em KNOWN-GAPS via HandoffReporter.
