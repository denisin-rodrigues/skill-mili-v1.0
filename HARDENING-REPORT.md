# HARDENING-REPORT — Milestone: Core Hardening and Quality Gates

- **Data**: 2026-07-27
- **Base**: auditoria independente (`AUDIT-REPORT.md`, achados V-01…V-09)
- **Escopo**: hardening e gates de qualidade. Nenhuma capacidade nova de mirror (sem SW, WebGL, Recreation, multi-route avançada).

---

## 1. Comandos executados e códigos de saída reais

| # | Comando | Exit | Resultado |
|---|---------|------|-----------|
| 1 | `npm ci` (node_modules removido antes) | 0 | 89 pacotes, instalação limpa |
| 2 | `npm run lint` | 0 | ESLint 9 flat config, 0 erros (7 achados reais corrigidos na 1ª execução) |
| 3 | `npm run lint:fix` | 0 | disponível e funcional |
| 4 | `npm run build` | 0 | 35 arquivos, 0 falhas de sintaxe |
| 5 | `npm run typecheck` (tsc --noEmit) | 0 | 0 erros |
| 6 | `npm test` (node:test) | 0 | **89/89 testes passam** (50 novos nesta milestone) |
| 7 | `node scripts/selftest.js` | 0 | **36/36 verificações PASS**, L4 fixture-scoped |
| 8 | `powershell -File install/windows/install-wsl.ps1 -DryRun` (via teste) | 0 | dry-run real, nada instalado |
| 9 | `bash install/linux/install.sh --dry-run` (via teste, WSL bash) | 0 | dry-run real, nada instalado |
| 10 | Guardian negativos (via `tests/unit/exit-codes.test.js`) | 4 / 3 / 2 | domínio bloqueado / expirada / config inválida |
| 11 | `node scripts/rewrite.js` em projeto com JS quebrado (via teste) | 9 | PARTIAL_RESULT + evidência em rewrite-report.json |
| 12 | curl/http traversal raw + encoded + double-encoded (via teste) | — | **403 em todos** (antes: 404/403 inconsistente) |

## 2. Entregáveis

| Entregável | Status | Onde |
|------------|--------|------|
| Configuração ESLint + scripts | ✅ | `eslint.config.mjs`, `npm run lint` / `lint:fix` |
| Correção V-02 (comparação ordinal) | ✅ | `scripts/lib/acceptance.js` (`LEVEL_ORDER`), regressão em `tests/unit/acceptance.test.js` |
| Correção V-03 (alias sem mutação tardia) | ✅ | `AssetRegistry.register` com `localRel` forçado; regressão em `tests/unit/asset-registry-alias.test.js` |
| Resolução central de paths | ✅ | `scripts/lib/safe-path.js` (`decodeRepeatedly`, `hasTraversal`, `isWithin`, `resolveWithin`, `resolveHttpPathname`) + aplicada em `serve.js` e `config.js` |
| Schemas ativos conectados | ✅ | `schemas/mirror-config.schema.json` (guardian), `schemas/serving-contract.schema.json` (serve), `schemas/manifest.schema.json` (report); `schemas/future/` para blueprint (PH-004) |
| Validadores reais | ✅ | `validators/index.js` (ajv 2020-12) — diretório não está mais vazio |
| Política de classificação por fixture | ✅ | `classification` com 9 campos; mensagem "L4 validado para o escopo e fixture declarados." |
| Política de degradação externa | ✅ | `computeAcceptance` + `CRITICAL_RESOURCE_TYPES` + `buildClassification`; `docs/adr/ADR-002` |
| Códigos de saída centralizados | ✅ | `scripts/lib/exit-codes.js` (enum 0/2/3/4/5/6/7/8/9) em 10 CLIs; 12 testes de contrato |
| Instaladores com dry-run | ✅ | `install.sh --dry-run`, `install-wsl.ps1 -DryRun` + checksum + need_cmd/Assert-AdminRights |
| ADRs | ✅ | `docs/adr/ADR-001-lint-and-code-quality.md`, `docs/adr/ADR-002-l4-external-degradation.md` |
| KNOWN-GAPS atualizado | ✅ | via `scripts/report.js` (novas limitações: escopo da classificação, schemas/future) |

## 3. Achados da auditoria → status

| Achado | Status | Evidência |
|--------|--------|-----------|
| **V-01** traversal raw normalizado antes da checagem | **Corrigido** | `resolveHttpPathname` inspeciona o path RAW (e double-encoded) antes de `new URL()`; testes provam 403 para `/../`, `..\`, `%2e%2e`, `%252e%252e` |
| **V-02** comparação de strings `level >= 'L2'` | **Corrigido** | `LEVEL_ORDER` ordinal; teste prova que `'LP' >= 'L2'` (string) era `true` e agora `levelAtLeast('LP','L2')` é `false` |
| **V-03** alias com `localRel` mutado após registro | **Corrigido** | override no `register()`; regressão prova que asset legítimo não recebe mais `__c_` falso e colisões reais seguem detectadas. O teste de regressão ainda pegou (e corrigimos) um segundo bug: compartilhamento intencional caía no detector de colisão |
| **V-04** entrada query-insensitive sombreada por variantes | **Corrigido** | ordem exata → plain → 404-sensível; teste `mixed.png` prova que plain e variante coexistem |
| **V-05** rewrite saía 0 com falhas de parse | **Corrigido** | exit `PARTIAL_RESULT(9)` quando há falhas; teste com JS quebrado prova exit 9 + evidência no relatório |
| **V-06** L4 sem degradação externa | **Corrigido** | gates ADR-002: crítica bloqueia, opcional registra, interação não exercitada bloqueia; 6 testes de política |
| **V-07** selftest sem limpeza prévia | **Corrigido** | cleanup de `capture/`, `mirror/`, `experience-blueprint/` e relatórios no início do selftest |
| **V-08** branch morta `authType === 'none'` | **Corrigido** | removida (inalcançável; tipos inválidos falham antes) |
| **V-09** filtro de console mascarava erros same-origin | **Mitigado** | `classifyConsoleError` agora exige host **não-local** comprovável (via `msg.location().url`); sem URL externa comprovável → `unexpected` (estrito) |
| Lint ausente | **Corrigido** | gate ativo, exit 0 |
| `validators/` vazio | **Corrigido** | validadores reais (ajv) consumindo 3 schemas ativos |
| Schemas sem consumidor | **Corrigido** | 3 ativos conectados; blueprint movido para `schemas/future/` com README de status |
| Instaladores não verificáveis | **Corrigido** | dry-run real executado nos dois instaladores + 7 testes estáticos/funcionais |

## 4. Critérios de conclusão

| # | Critério | Status |
|---|----------|--------|
| 1 | `npm run lint` aprovado | ✅ exit 0 |
| 2 | Build aprovado | ✅ 35 arquivos, 0 falhas |
| 3 | Testes anteriores continuam aprovados | ✅ 39 originais dentro dos 89 |
| 4 | Novos testes de regressão aprovados | ✅ 50 novos, todos passam |
| 5 | V-02 e V-03 corrigidas com evidência | ✅ testes de regressão dedicados |
| 6 | Path traversal bloqueado em Windows e Linux | ✅ separadores `/` e `\`, encodings, symlink/junction (teste com junction NTFS) |
| 7 | Schemas ativos possuem consumidores reais | ✅ guardian/serve/report |
| 8 | Diretórios vazios/enganosos resolvidos | ✅ `validators/` implementado; `schemas/future/` documentado |
| 9 | L4 limitado ao fixture e escopo exercitados | ✅ classification com 9 campos + mensagem escopada |
| 10 | Dependências externas críticas impedem L4 | ✅ gate + teste (`script` bloqueia, `image` tolera) |
| 11 | Códigos de saída consistentes | ✅ enum central + 12 testes de contrato |
| 12 | Dry-run dos instaladores funciona | ✅ exit 0 real nos dois, sem instalação |
| 13 | Nenhum mock/TODO/placeholder como concluído | ✅ verificado |
| 14 | HARDENING-REPORT com comandos e resultados reais | ✅ este arquivo |

## 5. Limitações que permanecem (declaradas, não escondidas)

- Erros de console com `net::ERR_*` sem URL de origem comprovável agora são tratados como
  **inesperados** (estrito por padrão) — pode elevar falsos positivos de classificação em
  sites com console ruidoso (documentado, preferível a mascarar).
- `install.sh` exige `EXPECTED_NODESOURCE_SHA256` para instalar Node via NodeSource —
  política de checksum real, mas exige que o usuário consulte o hash oficial (documentado).
- Symlink test usa junction NTFS (não exige admin); symlinks POSIX são cobertos pela mesma
  lógica de `realpath`, mas o teste executado foi no ambiente Windows.
- Lint não inclui regras de estilo/formatação (decisão ADR-001, não lacuna).

## 6. Veredito

# ✅ MILESTONE APROVADA

Todos os 14 critérios de conclusão atendidos com evidência executável e reproduzível.
Nenhuma restrição violada: sem novas capacidades de mirror, sem renomeações, sem alteração
de PRD.MD ou AUDIT-REPORT.md, sem redução de cobertura, sem issue fechada sem regressão.
