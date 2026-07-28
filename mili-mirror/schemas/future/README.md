# schemas/future — Schemas sem consumidor ativo

Schemas neste diretório **não são validados em runtime** pela versão atual do pipeline.

| Schema | Fase prevista | Motivo |
|--------|---------------|--------|
| `experience-blueprint.schema.json` | PH-004 (EditableRecreation) | O Blueprint completo (animações frame a frame, componentes, scroll-map) ainda não é produzido; o blueprint inicial do MVP é mais simples que este contrato. |

Regra do projeto (item 6 da milestone Core Hardening): schemas fora deste diretório
**precisam** ter um consumidor real em runtime (ver `validators/index.js`). Nenhum
schema pode parecer ativo sem ser utilizado.

Schemas ativos hoje:

- `schemas/mirror-config.schema.json` — validado pelo Guardian antes do scope.lock.
- `schemas/serving-contract.schema.json` — validado pelo servidor local ao iniciar.
- `schemas/manifest.schema.json` — validado pelo HandoffReporter antes do relatório.
