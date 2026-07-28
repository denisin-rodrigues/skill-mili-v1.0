# AUDIT-REPORT — Auditoria Técnica Independente

- **Projeto auditado**: Mili Mirror Site Agent Team (`mili-mirror/`, pacote técnico `nt-site-mirror@1.0.0`)
- **Data da auditoria**: 2026-07-24
- **Método**: leitura estática integral + reexecução independente de todo o pipeline (sem confiar no relatório anterior)
- **Escopo**: PRD.MD, README.md, SKILL.md, KNOWN-GAPS.md, REPORT.md, package.json, todo o código-fonte (exceto node_modules), todos os testes e fixtures

---

## 1. Alegações confirmadas (com evidência objetiva)

| # | Alegação | Evidência |
|---|----------|-----------|
| 1 | Pipeline completo | Execução independente das 7 fases via `node scripts/selftest.js` → **exit 0**; Guardian→Capture→Rewrite→Blueprint→Validate online→Validate offline→Report |
| 2 | 15/15 verificações aprovadas | Verdade na 1ª milestone. **Estado atual: 33/33 verificações PASS** (log `audit-selftest-run.log`, exit 0) |
| 3 | Classificação L4 | **Calculada, não escrita manualmente** — `validate.js` deriva L0→L1→L2→L3→L4 de `routesOk/missingFiles/localFailures/pageErrors/consoleErrors`; offline exige nível ≥ L2 computado. Persistida em `manifest.acceptanceLevel` |
| 4 | Guardian funcional | Aprova escopo válido (scope.lock.json, exit 0) e **nega 3 casos negativos reais**: domínio fora da autorização (exit 1), captura sem scope.lock (exit 1), autorização expirada (exit 1) |
| 5 | Allowlist deny-by-default | `domain-allowlist.json` com `"defaultPolicy": "deny"`; `blocked-external.jsonl` contém 6 bloqueios reais de `cdn.externo-fake.com/pixel.png` durante a captura |
| 6 | Captura Playwright real | Chromium 149.0.7827.55 real (registrado em `manifest.json`); requests interceptados por `page.route`; DOM pós-hidratação e screenshots por rota/viewport |
| 7 | Descoberta de lazy assets | `lazy.svg?v=2` só é requisitado após scroll + dynamic import literal; presente nos acquisition-records e no serving-contract |
| 8 | Hashes SHA-256 | Prova objetiva: hash recomputado com `Get-FileHash` de `mirror/assets/127.0.0.1/assets/style.css` **confere byte a byte** com `capture/hashes.sha256` |
| 9 | Servidor MIME, HEAD, byte-range | curl manual: `GET /` → 200 text/html; `Range: bytes=0-99` → **206 com exatos 100 bytes**; range inválido → **416**; `HEAD` → 200 com Content-Length + Accept-Ranges + nosniff |
| 10 | Validação desktop e mobile | `validation-results.json` com 6 combinações rota×viewport (3 rotas × desktop/mobile), todas HTTP 200 |
| 11 | Validação offline real | Execução manual `--offline` → exit 0, L4; **2 tentativas externas registradas e bloqueadas**; código não usa `launchPersistentContext`/`userDataDir`/`storageState` — **browser e contextos novos a cada execução, sem cache aquecido** |
| 12 | Blueprint e relatório gerados | `experience-blueprint/*.json` (9 arquivos) + REPORT/KNOWN-GAPS/DEPENDENCIES/AUTHORIZATION-SUMMARY/LAUNCH — **todos os 18 arquivos declarados existem** |
| 13 | Screenshots correspondem à execução | mtimes 19:57–19:58 (-03:00) ≡ `validatedAt` 22:57–22:58Z da mesma execução |
| 14 | Sem segredos nos logs | Varredura por cookie/authorization/bearer/token nos artefatos gerados: apenas `redaction-policy.json` (a própria política) e o hash SHA-256 da autorização (by design) |
| 15 | CLI conecta o fluxo real | package.json mapeia 13 scripts para arquivos existentes; `validate.js` importa `createMirrorServer` do servidor real; `rewrite.js` importa os 3 rewriters reais |

## 2. Alegações parcialmente confirmadas

| Alegação | Situação |
|----------|----------|
| "46 arquivos funcionais" | Verdade na 1ª milestone. **Estado atual: 84 arquivos** (19 scripts, 12 agents, 7 templates, 36 testes/fixtures, docs, install). Alegação desatualizada, não falsa |
| "15/15 verificações" | Idem — substituída por 33/33 na milestone atual |

## 3. Alegações não confirmadas / lacunas

| Item | Achado |
|------|--------|
| **Lint** | **Não configurado**: nenhum `.eslintrc`/`eslint.config.*`/`biome.json` e nenhum script `lint` no package.json. O item 4 da bateria solicitada não pôde ser executado. **Lacuna real do projeto.** |
| Schemas em `templates/*.schema.json` | **Não são usados por nenhum código em runtime** — funcionam apenas como documentação de contrato. Nenhum arquivo é validado contra eles |
| `validators/` | Diretório **vazio** (README o declara como "reservado pós-MVP" — honesto, mas é um artefato sem função) |

## 4. Testes realmente executados (comandos + códigos de saída)

| # | Comando | Exit | Resultado |
|---|---------|------|-----------|
| 1 | `Remove-Item node_modules; npm ci` | 0 | 15 pacotes, instalação limpa OK |
| 2 | `npm run build` | 0 | 26 arquivos verificados, 0 falhas |
| 3 | `npm run typecheck` (tsc --noEmit) | 0 | 0 erros |
| 4 | `npm test` (node --test) | 0 | **39/39 testes, 142 asserts** |
| 5 | `node scripts/selftest.js` | 0 | **33/33 verificações**, L4, rewrite 35 reescritas/0 falhas |
| 6 | `node scripts/doctor.js` | 0 | ambiente pronto |
| 7 | `node scripts/validate.js --offline` (manual) | 0 | 6/6 rotas OK, byte-range 206, L4 |
| 8 | curl rotas `/` e `/produto/detalhe` | — | 200 / 200 |
| 9 | curl `Range: bytes=0-99` em `intro.mp4?v=hd` | — | **206, 100 bytes exatos** |
| 10 | curl range inválido | — | **416 Range Not Satisfiable** |
| 11 | curl `HEAD /assets/logo.svg` | — | 200, Content-Length 259, Accept-Ranges |
| 12 | curl arquivo inexistente / query não declarada | — | **404 / 404** (sem fallback indevido) |
| 13 | curl path traversal raw + encoded | — | **404 / 403** (nenhum arquivo vazado) |
| 14 | Guardian: domínio fora da autorização | 1 | **NEGADO** ✓ |
| 15 | Capture sem scope.lock | 1 | **RECUSADO** ✓ |
| 16 | Guardian: autorização expirada | 1 | **NEGADO** ✓ |
| 17 | curl `POST /` | — | **405** |

## 5. Verificações de integridade dos testes

- **Testes sempre-verdadeiros**: nenhum padrão `assert.ok(true)`/`assert.equal(1,1)` encontrado; os 6 arquivos de teste têm 15–34 asserts reais cada (142 no total)
- **Mocks apresentados como reais**: nenhum. O site fixture é explicitamente rotulado como fixture de teste; MP4 e WOFF2 são arquivos reais gerados/baixados; o servidor fixture implementa redirect/range/query-mapping reais
- **TODOs críticos**: nenhum (apenas a palavra "Todo/Toda" em prosa em português)
- **Erros ignorados**: 1 `catch {}` intencional e comentado (`networkidle` best-effort no scroll); nenhum outro swallow silencioso
- **process.exitCode**: todos os usos corretos (exit 1 apenas em falha real; nenhuma manipulação para forçar sucesso)
- **L4**: calculado (ver §1.3), não manual
- **Offline sem cache aquecido**: browser novo por execução (ver §1.11)

## 6. Vulnerabilidades e achados de código (não corrigidos, conforme instrução)

| # | Severidade | Achado |
|---|-----------|--------|
| V-01 | Baixa | `serve.js`: o parser WHATWG URL normaliza `..` antes da checagem explícita — traversal raw vira 404, encoded vira 403. **Bloqueio funciona**, mas a ordem das defesas é frágil/inconsistente |
| V-02 | Baixa | `validate.js`: gate do L4 usa comparação de strings `level >= 'L2'` — funciona para o enum atual ('L3' ≥ 'L2' lexicograficamente), padrão frágil |
| V-03 | Baixa | `capture.js`: alias de redirect tem `localRel` mutado **após** registro no `pathOwners` — entrada contábil obsoleta pode gerar sufixo de colisão desnecessário (inócuo) em ativo futuro com mesmo path sanitizado |
| V-04 | Baixa | `serve.js`: path com entrada query-insensitive E variantes de query teria a entrada simples sombreada (`querySensitivePaths` vence) — caso de borda não coberto pelo fixture |
| V-05 | Info | `rewrite.js`: falhas de parse JS geram entradas `failed` no rewrite-report mas **não** alteram o exit code (só exceções de arquivo alteram) — escolha deliberada, porém `rewrite` pode sair 0 com falhas de parse presentes (visíveis no relatório) |
| V-06 | Info | L4 offline exige apenas rotas 200 + zero falhas locais; **não verifica degradação visual** causada por recursos externos bloqueados (leniente vs. o espírito do PRD) |
| V-07 | Info | `selftest.js` não limpa diretórios de saída antes de rodar — arquivos obsoletos de configs anteriores poderiam persistir (não observado na prática) |
| V-08 | Info | `guardian.js`: branch `authType === 'none'` é inalcançável (falha antes na lista de tipos válidos) — código morto inócuo |
| V-09 | Info | Filtro de `net::ERR_*` como "erros esperados" também se aplica ao modo online — pode mascarar erro de rede same-origin legítimo que case com o padrão (risco baixo; falhas locais são rastreadas por outros handlers) |

## 7. Falsos positivos identificados

- Nenhum falso positivo nos testes: as 33 asserções do selftest verificam artefatos reais em disco, HTTP real contra o servidor e conteúdo real de arquivos reescritos
- Os erros de console `net::ERR_BLOCKED_BY_CLIENT` (pixel externo) são corretamente classificados como **esperados** (política da allowlist), não como defeito do mirror — classificação honesta, não mascaramento

## 8. Arquivos não utilizados

- `validators/` (diretório vazio)
- `templates/*.schema.json` (3 schemas sem consumidor em runtime)
- `install/` (não executável neste ambiente — Windows nativo; scripts miram WSL/Linux — não verificados em runtime nesta auditoria)

## 9. Limitações (coerentes com KNOWN-GAPS.md)

- JS dinâmico (concatenação/template literals) nunca é reescrito — registrado como `dynamic-expression`
- Conteúdo interno de source maps não é reescrito
- Resserialização parse5/postcss pode alterar formatação (semântica preservada)
- Alias de redirect serve 200 (não reproduz 30x)
- DOM pós-hidratação pode reaplicar efeitos de scripts (lazy asset aparece duplicado — documentado)
- WebGL, Service Worker, Editable Recreation: fora de escopo (declarado)

## 10. Nível de aceitação real

- **Projeto fixture (prova ponta a ponta): L4 — Offline Validated**, com evidência completa e reproduzível
- **Sites reais arbitrários**: L2–L3 plausível; L4 depende de dependências externas do site alvo
- O pipeline nunca declara nível sem evidência correspondente em `validation-results.json`

## 11. Recomendação final

# ✅ APROVADO — com observações não bloqueantes

**Justificativa**: todas as alegações centrais foram verificadas independentemente com comandos reais e códigos de saída reais; a classificação L4 é computada (não escrita); Guardian nega casos negativos; a allowlist bloqueia na prática; hashes conferem; offline usa sessão nova; nenhum segredo vaza; nenhum teste é sempre-verdadeiro; nenhum mock é apresentado como implementação real.

**Observações para a próxima milestone (não bloqueantes)**:
1. Adicionar lint (eslint config + script `lint`) — lacuna real
2. Corrigir V-03 (registro de alias antes da mutação de localRel)
3. Substituir comparação de strings do gate L4 por comparação ordinal explícita (V-02)
4. Avaliar validação dos artefatos contra os schemas de `templates/` ou removê-los/movê-los para docs
5. Considerar gate adicional no L4 para degradação por recursos externos bloqueados (V-06)
