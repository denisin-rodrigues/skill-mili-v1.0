# Arquitetura — Mili Mirror Site Agent Team

Estilo: **pipeline multiagente com estado persistente**. Cada fase produz artefatos
imutáveis que alimentam a fase seguinte; evidências anteriores não são alteradas
silenciosamente (retentativas criam novas evidências).

## Fluxo de dados

```
URL autorizada
  │
  ▼
Guardian ─────────────────────────────► scope.lock.json (approved)
  │                                       domain-allowlist.json / redaction-policy.json
  ▼
EnvironmentBootstrap ─────────────────► environment-report.json / runtime-versions.lock
  ▼
ScopePlanner ─────────────────────────► capture-plan.yaml (rotas, viewports, critérios)
  ▼
capture.js (RuntimeScout + RouteAndStateExplorer + AssetAcquisition)
  │  Chromium real · allowlist (deny default) · rate limit
  │  scroll incremental · snapshots DOM · screenshots
  ▼
  ├─ mirror/pages/*.html                (DOM pós-hidratação, URLs reescritas)
  ├─ mirror/assets/<host>/…             (corpos de resposta autorizados)
  ├─ capture/acquisition-records.jsonl  (URL, MIME, tamanho, SHA-256, rota, classificação)
  ├─ capture/manifest.json · hashes.sha256 · redirects.json
  └─ capture/serving-contract.json      (rotas → arquivos, assets → arquivos)
  ▼
blueprint.js ─────────────────────────► experience-blueprint/*.json
  ▼
server/serve.js (LocalRuntimeEngineer)  127.0.0.1:4173 · MIME · HEAD · 206 byte-range · 404 real
  ▼
validate.js (QAAndEvidence) ──────────► validation-results.json (nível L0–L4 + razões)
  │        ├─ online                    screenshots local-*.png
  │        └─ --offline (rede externa bloqueada no contexto)
  ▼
report.js (HandoffReporter) ──────────► REPORT.md · LAUNCH.md · KNOWN-GAPS.md
                                        DEPENDENCIES.md · AUTHORIZATION-SUMMARY.md
```

## Contratos entre componentes

| Artefato | Produtor → Consumidores | Schema |
|----------|------------------------|--------|
| `scope.lock.json` | guardian → todos | status, domains, routes, viewports, authorizationHash |
| `serving-contract.json` | capture → serve/validate | `schemas/serving-contract.schema.json` (ativo) |
| `manifest.json` | capture → report | `schemas/manifest.schema.json` (ativo) |
| `mirror.config.yaml` | usuário → guardian | `schemas/mirror-config.schema.json` (ativo) |
| `experience-blueprint/*.json` | blueprint → recreation/QA | `schemas/future/experience-blueprint.schema.json` (PH-004, sem consumidor) |
| `validation-results.json` | validate → report | por rota/viewport + totais + classification |
| `acquisition-records.jsonl` | capture → blueprint/report | ver PRD (assetRecordExample) |

## Modelo de segurança

- **AuthorizationFirst**: `requireScopeLock()` bloqueia capture/blueprint/validate/report sem
  escopo aprovado. Guardian verifica tipo, validade, domínios e rotas (DV-001…DV-004).
- **Allowlist (deny by default)**: `page.route` aborta origens fora de `scope.lock.domains`;
  cada bloqueio vira evidência em `blocked-external.jsonl`.
- **Redaction**: `cookie`, `authorization`, tokens e padrões (Bearer, JWT, `token=`) são
  mascarados em headers, logs e console (`scripts/lib/redact.js`).
- **Servidor local**: bind 127.0.0.1, confinamento de path (anti-traversal), 404 real,
  `nosniff`, sem SPA fallback por padrão.
- **Sem ações irreversíveis**: interações se limitam a scroll no MVP; formulários desabilitados.
- **Sessões autenticadas**: login manual do usuário; estado de autenticação não entra na entrega.

## Decisões de implementação (MVP) e limites conhecidos

1. **HTML servido = DOM pós-hidratação** (`page.content()`), com URLs absolutas de recursos
   capturados reescritas para caminhos locais. Scripts capturados podem reaplicar efeitos já
   presentes no DOM — limitação documentada; a alternativa é Editable Recreation.
2. **JS não é reescrito** — URLs absolutas dentro de bundles permanecem externas (documentado).
3. **Query strings são ignoradas** na resolução de assets pelo servidor; o sufixo `__q_<hash>`
   no armazenamento evita colisão de arquivos, mas duas queries diferentes no mesmo path
   compartilham uma entrada no contrato (a primeira vence; ver KNOWN-GAPS).
4. **Service Workers/dynamic imports/workers**: detectados e registrados; replicação é PH-002.
5. **WebGL/Three.js**: arquivos preservados; inspeção de cena é PH-003.
6. **Classificação honesta**: L0–L4 calculada a partir de evidências; módulos não exercitados
   são marcados `unexercised`, nunca apresentados como completos.

## Onde cada requisito do PRD vive

| PRD | Implementação |
|-----|---------------|
| A-001 Guardian | `scripts/guardian.js`, `scripts/lib/allowlist.js`, `scripts/lib/redact.js` |
| A-002 EnvironmentBootstrap | `scripts/doctor.js`, `install/*` |
| A-003 ScopePlanner | `templates/capture-plan.yaml`, edição assistida |
| A-004/A-005/A-006 | `scripts/capture.js` |
| A-007 WebGL/Media | sinais em `blueprint.js`; byte-range em `server/serve.js` + `validate.js` |
| A-008 Blueprint | `scripts/blueprint.js` |
| A-009 LocalRuntime | `server/serve.js` |
| A-010 Recreation | `agents/recreation.md` (protocolo; PH-004) |
| A-011 QA | `scripts/validate.js` |
| A-012 Handoff | `scripts/report.js`, `templates/report-template.md` |
| FR-024 retomada | artefatos por fase; rerodar só a fase que falhou |
