# REPORT — {{project}}

- Origem autorizada: {{source}}
- Gerado em: {{generatedAt}}
- Classificação: **{{classification}}**
- Método: {{mode}}
- Hash da autorização: `{{authorizationHash}}`

## Resumo da captura

| Métrica | Valor |
| --- | --- |
| Rotas declaradas | {{routesDeclared}} |
| Rotas exercitadas | {{routesExercised}} |
| Viewports | {{viewports}} |
| Interações declaradas | {{interactionsDeclared}} |
| Interações exercitadas | {{interactionsExercised}} |
| Requisições observadas | {{requestsObserved}} |
| Recursos locais | {{resourcesLocal}} |
| Recursos bloqueados (fora da allowlist) | {{resourcesBlocked}} |
| Falhas de aquisição | {{resourcesFailed}} |

## Validação técnica

- Byte-range (HTTP 206): {{byteRange}}
- Offline validado: {{offlineValidated}}

## Perguntas obrigatórias do handoff

1. **O que foi preservado?** Recursos listados em `capture/manifest.json` e `capture/acquisition-records.jsonl`.
2. **O que foi reconstruído?** Nada neste modo (static-mirror).
3. **Quais rotas foram testadas?** Ver `capture/validation-results.json`.
4. **Quais viewports foram testados?** {{viewports}}.
5. **Quais interações foram exercitadas?** Ver manifest (scroll no MVP).
6. **Quais recursos continuam externos?** Ver `DEPENDENCIES.md`.
7. **Quais recursos foram bloqueados?** Ver `capture/logs/blocked-external.jsonl`.
8. **Quais estados não foram exercitados?** Ver `KNOWN-GAPS.md`.
9. **O projeto funciona offline?** {{offlineValidated}}.
10. **Qual é o comando de inicialização?** `node server/serve.js --contract capture/serving-contract.json`
11. **O resultado é mirror, recreation, hybrid, inspired ou partial?** {{mode}}.

## Evidências

- Screenshots: `capture/screenshots/`
- Logs de console: `capture/logs/`
- Manifesto: `capture/manifest.json`
- Hashes: `capture/hashes.sha256`
- Blueprint: `experience-blueprint/`
