# ADR-002 — Política de degradação externa no cálculo de L4

- **Status**: aceito
- **Data**: 2026-07-27
- **Contexto**: a auditoria (V-06) apontou que o L4 offline exigia apenas rotas 200 e
  zero falhas locais — sem diferenciar dependência externa opcional de crítica, e sem
  considerar interações declaradas não exercitadas. Também era preciso impedir que
  "L4 num fixture" soasse como "L4 para qualquer site".

## Decisões

### 1. Níveis são ordinais, nunca comparados como strings (V-02)

`LEVEL_ORDER = { L0:0, L1:1, LP:2, L2:3, L3:4, L4:5, LR:6 }` em `scripts/lib/acceptance.js`.
Comparação lexicográfica anterior admitia absurdos (`'LP' >= 'L2'` era `true`).

### 2. Tipos de recurso críticos vs opcionais

- **Críticos** (ausência quebra a página): `document`, `stylesheet`, `script`, `xhr`,
  `fetch`, `worker`, `shared_worker`, `websocket`.
- **Opcionais**: `image`, `media`, `font`, `ping`, `beacon`, `manifest`, demais tipos.

Justificativa: uma imagem externa bloqueada degrada sem destruir; um script/CSS/XHR
crítico ausente muda o comportamento estrutural da experiência. A classificação usa
`request.resourceType()` do Playwright (evidência real, não heurística de URL).

### 3. Gates do L4 (todos obrigatórios)

1. Nível base computado ≥ L2 (rotas 200, zero 404 local, zero falha local) **no modo
   offline, em sessão nova**;
2. **Zero tentativas externas críticas** durante o teste offline;
3. **Zero interações declaradas não exercitadas** (honestidade: não se declara validado
   o que não foi exercitado).

Tentativas externas **opcionais** são toleradas mas sempre registradas em
`validation-results.json → classification.externalDependencies` com `criticality`.

### 4. Anti-rigidez e anti-permissividade

- Não mais rígido: dependências opcionais documentadas NÃO bloqueiam L4.
- Não mais permissivo: arquivo local crítico ausente já impede até L2; tentativa
  crítica offline impede L4; interação não exercitada impede L4.

### 5. L4 é sempre escopado (nunca universal)

`validation-results.json → classification` registra `validationTarget`
(`local-controlled-fixture` | `authorized-site`), `fixtureId`, `scopeType`,
`capabilitiesExercised`, `capabilitiesNotExercised`, `knownLimitations`,
`externalDependencies` e `confidence`. A mensagem ao usuário é:

> "L4 validado para o escopo e fixture declarados."

e nunca qualquer variação de "suporte L4 para qualquer site".
