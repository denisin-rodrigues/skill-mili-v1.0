# A-012 — HandoffReporter

**Propósito**: produzir uma entrega profissional, reproduzível e transparente.

**Quando atuar**: fase 8, após validação.

```bash
node scripts/report.js --config mirror.config.yaml
```

## Entregáveis (MVP)

- `REPORT.md` — resumo executivo, métricas, validação, respostas obrigatórias
- `LAUNCH.md` — comando de inicialização e revalidação
- `KNOWN-GAPS.md` — interações não exercitadas, bloqueados, falhas, limitações do método
- `DEPENDENCIES.md` — hosts capturados vs bloqueados
- `AUTHORIZATION-SUMMARY.md` — escopo, validade, hash da autorização
- `capture/manifest.json`, `capture/serving-contract.json`, `capture/validation-results.json`,
  `capture/hashes.sha256`, `experience-blueprint/`

## Perguntas obrigatórias (respondidas no REPORT.md)

1. O que foi preservado?
2. O que foi reconstruído?
3. Quais rotas foram testadas?
4. Quais viewports foram testados?
5. Quais interações foram exercitadas?
6. Quais recursos continuam externos?
7. Quais recursos foram bloqueados?
8. Quais estados não foram exercitados?
9. O projeto funciona offline?
10. Qual é o comando de inicialização?
11. O resultado é mirror, recreation, hybrid, inspired ou partial?

## Mensagem de conclusão (modelo)

```
Captura concluída.

Classificação: <nível L0–L4/LR/LP>
Método: Static Mirror | Editable Recreation | Hybrid | Inspired | Partial
Rotas declaradas: N | Rotas validadas: M
Viewports validados: V
Interações declaradas: I | Interações validadas: J
Recursos locais: A | Dependências externas: B | Bloqueados: C
Estados não exercitados: K
Offline validado: sim|não

Comando de inicialização:
  node server/serve.js --contract capture/serving-contract.json

Consulte: REPORT.md, KNOWN-GAPS.md, DEPENDENCIES.md, capture/manifest.json, experience-blueprint/
```

## Regras de honestidade

- O nível declarado deve ter evidência correspondente em `validation-results.json`.
- Lacunas vão para KNOWN-GAPS — nunca escondidas (CP-009).
- Se o mínimo do capture-plan não foi atingido: classificar **LP** e propor Recreation (A-010).

## Definition of Done (checklist final)

- [ ] Autorização válida e escopo travado
- [ ] Projeto inicia pelo comando documentado
- [ ] Rotas declaradas testadas, sem arquivos locais críticos ausentes
- [ ] Blueprint, manifesto e hashes gerados
- [ ] Dependências externas e estados não exercitados informados
- [ ] Nível de aceitação declarado com evidência
- [ ] Sem cookies/tokens/credenciais na entrega
- [ ] Sem alegação de recuperação de código privado
- [ ] Desktop e mobile validados; mídia/3D verificados quando aplicáveis
