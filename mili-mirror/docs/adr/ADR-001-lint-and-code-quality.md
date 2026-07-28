# ADR-001 — Lint e qualidade de código

- **Status**: aceito
- **Data**: 2026-07-27
- **Contexto**: a auditoria independente apontou que o projeto não tinha lint configurado
  (lacuna real). Este ADR registra as decisões de configuração.

## Decisões

1. **ESLint 9 (flat config `eslint.config.mjs`)** — formato oficial atual; o projeto é
   ESM puro, sem transpilação.
2. **Base: `js.configs.recommended`** — conjunto de regras de CORRETUDE (não estilísticas).
   Prettier/formatação fica fora do lint por decisão: regras de estilo geram ruído sem
   ganho de segurança neste estágio.
3. **Regras adicionadas e justificativa**:
   - `no-unused-vars` (com `argsIgnorePattern: '^_'`): pegou 7 problemas reais na
     primeira execução (variáveis mortas, import órfão, parâmetro inútil).
   - `no-empty` sem `allowEmptyCatch`: catch vazio precisa de comentário explicativo
     (ex.: espera best-effort de networkidle no scroll). Não desativamos a regra;
     o único catch vazio do projeto já é comentado e intencional.
   - `eqeqeq` (com exceção `null`): evita coerção acidental sem proibir `== null`.
   - `no-var`, `prefer-const`: consistência ESM moderna.
   - `no-console: off` — **justificativa**: este é um projeto de CLI; a saída de
     console É a interface do produto (mensagens em pt-BR). Desativar seria quebrar
     o produto, não melhorá-lo.
   - `no-control-regex: off` — **justificativa**: as regexes de sanitização de path
     removem intencionalmente caracteres de controle (proteção contra injeção).
4. **Globals de browser para scripts/**: callbacks de `page.evaluate` executam no
   navegador via Playwright (`window`, `document`). Sem isso, `no-undef` produziria
   falsos positivos em código legítimo.
5. **Ignores**: `node_modules`, saídas geradas do pipeline (`capture/`, `mirror/`,
   `experience-blueprint/`), logs, outputs e **fixtures binários** (png/mp4/woff2).
   Fixtures de texto escritos à mão SÃO lintados (o lint pegou `var` em fixture órfão,
   que foi removido).
6. **Scripts**: `npm run lint` e `npm run lint:fix`. O lint é gate de conclusão
   (critério 1 da milestone Core Hardening).
7. **Política de campos desconhecidos em schemas** (relacionada): `mirror.config.yaml`
   aceita campos desconhecidos (compatibilidade futura); `serving-contract.json` rejeita
   (contrato interno estrito, produzido por nós). Ver `schemas/` e `validators/index.js`.
