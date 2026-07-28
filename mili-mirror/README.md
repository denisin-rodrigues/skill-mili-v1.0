# Mili Mirror Site — Mili Site Mirror Agent Team

Sistema multiagente para **captura autorizada**, análise, reconstrução editável e validação de
experiências frontend. Transforma uma URL autorizada em um **baseline local reproduzível,
validado, documentado e editável**.

> **Aviso legal**: esta ferramenta existe para sites **próprios ou com autorização documentada**.
> Ela não contorna autenticação, CAPTCHA, paywall, DRM, WAF ou anti-bot, não extrai backend ou
> banco de dados e não recupera repositórios. Sem autorização, o Guardian bloqueia a captura.

## O que o MVP entrega (PH-001)

- Abertura do site em **Chromium real** (Playwright) com interceptação de rede por rota.
- Descoberta de **recursos tardios** via scroll incremental (lazy assets, dynamic imports observados).
- **Allowlist de domínios** com bloqueio padrão de origens externas + **mascaramento de segredos**.
- Assets preservados em `mirror/assets/` com **SHA-256**, manifesto e trilha de redirecionamentos.
- **Servidor local** com rotas exatas, MIME correto, HEAD, **byte-range (HTTP 206)**, 404 real,
  proteção contra path traversal e binding em 127.0.0.1.
- Validação **desktop + mobile**, console, rede, arquivos ausentes e **modo offline**.
- **Experience Blueprint inicial** + relatório honesto com lacunas conhecidas (KNOWN-GAPS).

Roadmap pós-MVP: Service Workers/dynamic imports avançados (PH-002), WebGL/Three.js (PH-003),
Editable Recreation (PH-004), editor visual (PH-005), produto comercial (PH-006).

## Instalação

Pré-requisitos: **Node.js ≥ 18** (Linux, macOS ou Windows/WSL 2).

```bash
cd nt-site-mirror
npm install
npx playwright install chromium   # ou: npx playwright install --with-deps chromium (Linux)
```

Instaladores assistidos: `install/linux/install.sh` (apt + node + playwright) e
`install/windows/install-wsl.ps1` (prepara WSL 2 sem tocar em partições/firewall/antivírus).

Verifique o ambiente:

```bash
node scripts/doctor.js --browsers
```

O diagnóstico confirma o Chromium oficial e o acesso CDP, detecta Chrome Stable/Firefox
opcionais e lista somente os perfis persistentes pertencentes ao Mili.

## Quickstart

1. **Autorização** — copie `templates/authorization.yaml` e `templates/mirror.config.yaml`
   para a pasta do seu projeto e preencha (o agente Guardian conduz essa entrevista).
2. **Trave o escopo**:

   ```bash
   node scripts/guardian.js --config mirror.config.yaml --authorization authorization.yaml
   ```

3. **Capture**:

   ```bash
   node scripts/capture.js --config mirror.config.yaml
   # opções: --headed (navegador visível)  --routes /,/produto,/sobre
   ```

4. **Blueprint + validação**:

   ```bash
   node scripts/blueprint.js --config mirror.config.yaml
   node scripts/validate.js --config mirror.config.yaml
   node scripts/validate.js --config mirror.config.yaml --offline
   node scripts/validate.js --config mirror.config.yaml --browser chrome
   node scripts/validate.js --config mirror.config.yaml --browser firefox
   node scripts/validate.js --config mirror.config.yaml --all-enabled-browsers
   ```

   Resultados de Chrome/Firefox ficam em `capture/browser-validation/` e nunca alteram o
   manifesto oficial. A matriz completa é gravada em `capture/browser-matrix.json`.

5. **Execute o mirror**:

   ```bash
   node server/serve.js --contract capture/serving-contract.json
   # http://127.0.0.1:4173
   ```

6. **Relatório de handoff**:

   ```bash
   node scripts/report.js --config mirror.config.yaml
   ```

Perfis de cache warm, quando habilitados, ficam exclusivamente em
`<output>/.mili/browser-profiles`. Para inspecionar ou limpar apenas essa área:

```bash
node scripts/browser.js list-profiles --config mirror.config.yaml
node scripts/browser.js clean-profiles --config mirror.config.yaml
```

## Self-test (prova o pipeline ponta a ponta em localhost)

```bash
npm run selftest
```

Sobe um site fixture controlado, executa guardian → capture → blueprint → validate (online e
offline) → report e verifica os critérios MVP-001…MVP-017. Saída esperada: todas as
verificações `PASS` e classificação **L4**.

## Estrutura

```
nt-site-mirror/
├── SKILL.md            # orquestração do agent team (carregue esta skill)
├── agents/             # protocolo dos 12 agentes
├── templates/          # authorization/config/plan + report-template
├── schemas/            # JSON schemas ATIVOS (com consumidor em runtime)
│   └── future/         # schemas de fases futuras (sem consumidor — ver README local)
├── validators/         # validadores reais (ajv) dos schemas ativos
├── browser/            # policy, contextos, detecção, CDP centralizado e browser matrix
├── scripts/            # guardian, doctor, capture, rewrite, blueprint, validate, report, selftest
├── server/serve.js     # servidor local do mirror (byte-range, 404 real, safe-path)
├── install/            # WSL 2 (Windows) e Linux — ambos com modo --dry-run
├── docs/ARCHITECTURE.md
├── docs/adr/           # decisões de arquitetura (ADR-001 lint, ADR-002 L4)
└── tests/              # unit/ (node:test) + fixture/ (site controlado + self-test)
```

## Qualidade (gates)

```bash
npm run lint        # ESLint (flat config) — gate obrigatório
npm run lint:fix
npm run build       # syntax check de todos os arquivos
npm run typecheck   # tsc --noEmit (checkJs)
npm test            # testes unitários (node:test)
npm run selftest    # integração ponta a ponta
```

## Classificação de honestidade

Todo resultado declara um nível: **L0** (falhou), **L1** (primeira tela), **L2** (rotas
validadas), **L3** (experiência validada), **L4** (offline validado), **LR** (recriado),
**LP** (parcial). Estados não exercitados são sempre declarados em `KNOWN-GAPS.md` — nunca
apresentados como concluídos.
