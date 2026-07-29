# Mili Site Mirror Agent Team

Sistema multiagente para **captura autorizada**, análise, reconstrução editável e
validação de experiências frontend. Recebe uma URL autorizada e produz um
**baseline local reproduzível, validado, documentado e editável**.

> **Leia [AUTHORIZATION-POLICY.md](./AUTHORIZATION-POLICY.md) antes de usar.**
> Esta ferramenta é para sites **próprios ou com autorização real** — e a
> verificação de autorização hoje é majoritariamente autodeclarada. Não
> contorna autenticação, CAPTCHA, paywall, DRM, WAF ou anti-bot; não extrai
> backend/banco de dados; não recupera repositórios de terceiros.

## O que ela faz

1. **Guardian** valida autorização e trava o escopo (domínios, rotas) antes de
   qualquer captura.
2. **Static Mirror**: abre o site em Chromium real (Playwright), descobre
   recursos tardios (scroll, lazy assets, dynamic imports), preserva tudo com
   SHA-256 e serve localmente com byte-range, 404 real e proteção contra path
   traversal.
3. **Validação honesta**: classifica o resultado em níveis **L0–L4** (falhou →
   offline validado) com base em evidência real — nunca em aparência.
4. **Editable Recreation** (fallback): quando o mirror não atinge o nível
   mínimo, gera um projeto React/Vite com conteúdo/tema separados do layout,
   cases individuais, e validação Playwright própria (desktop/mobile/
   `prefers-reduced-motion`).
5. **Handoff transparente**: `REPORT.md`, `KNOWN-GAPS.md`, `DEPENDENCIES.md` —
   todo estado não testado é declarado, nunca apresentado como concluído.

## Estrutura do repositório

```
.
├── AUTHORIZATION-POLICY.md   # leia isso primeiro
├── LICENSE                   # MIT (cobre o código, não autoriza uso indevido)
├── PRD.MD                    # especificação completa do produto
└── mili-mirror/               # a ferramenta em si
    ├── SKILL.md               # orquestração do agent team (para Claude Code)
    ├── agents/                 # protocolo dos 12 agentes
    ├── scripts/                 # pipeline: guardian, capture, blueprint, validate,
    │                           #   recreate, validate-recreation, compare-recreation-visual, report
    ├── templates/               # authorization/config/plan + template React/Vite de Recreation
    ├── server/serve.js          # servidor local do mirror
    ├── browser/                 # policy, contextos, CDP, browser matrix
    ├── install/                 # instaladores Linux e WSL 2 (Windows), com --dry-run
    ├── docs/ARCHITECTURE.md     # arquitetura e contratos entre componentes
    └── tests/                   # unit/ (node:test) + fixture/ (self-test)
```

## Instalação e primeiro uso

Pré-requisitos: **Node.js ≥ 18.17** (Linux, macOS ou Windows/WSL 2).

```bash
git clone https://github.com/denisin-rodrigues/skill-mili-v1.0.git
cd skill-mili-v1.0/mili-mirror
npm install
npx playwright install chromium
```

Confirme o ambiente:

```bash
node scripts/doctor.js --browsers
```

Rode o self-test (sobe um site fixture local e valida o pipeline inteiro,
sem tocar em nenhum site real):

```bash
npm run selftest
```

Saída esperada: todas as verificações `PASS` e classificação **L4**.

### Começando um caso de estudo do zero

1. Copie os templates de autorização/config:
   ```bash
   cp templates/authorization.yaml meu-projeto/authorization.yaml
   cp templates/mirror.config.yaml meu-projeto/mirror.config.yaml
   ```
2. Preencha `authorization.yaml` — domínio, rotas autorizadas, tipo de
   autorização e responsável. **Se for autorização de terceiro (cliente,
   empregador), guarde a prova real** (arquivo `.well-known`, e-mail,
   documento) — o Guardian não verifica isso automaticamente por você.
3. Trave o escopo e capture:
   ```bash
   node scripts/guardian.js --config meu-projeto/mirror.config.yaml --authorization meu-projeto/authorization.yaml
   node scripts/capture.js --config meu-projeto/mirror.config.yaml
   ```
4. Gere o blueprint e valide:
   ```bash
   node scripts/blueprint.js --config meu-projeto/mirror.config.yaml
   node scripts/validate.js --config meu-projeto/mirror.config.yaml
   node scripts/validate.js --config meu-projeto/mirror.config.yaml --offline
   ```
5. Se a classificação ficar **L0/L1**, use o fallback editável — ver
   [mili-mirror/README.md](./mili-mirror/README.md#quickstart) e
   [mili-mirror/agents/recreation.md](./mili-mirror/agents/recreation.md).
6. Gere o relatório de handoff:
   ```bash
   node scripts/report.js --config meu-projeto/mirror.config.yaml
   ```

Guia completo, comandos de qualidade (`lint`/`typecheck`/`test`/`build`) e
classificação de honestidade (L0–L4, LR, LP): veja
**[mili-mirror/README.md](./mili-mirror/README.md)**.

## Estado atual (honesto)

**Funcionando e testado** (123 testes unitários, lint/typecheck limpos,
self-test end-to-end): captura estática, validação online/offline,
Editable Recreation com cases individuais e validação de rotas de case,
comparação visual aproximada mirror-vs-recreation.

**Não implementado ainda**: reconstrução automática de cenas WebGL/Three.js
(existe só como protótipo manual em um projeto de exemplo, não gerado pelo
pipeline), editor visual (PH-005), verificação criptográfica automática de
domínio (o Guardian aceita autorização autodeclarada — a verificação real é
um passo manual, ver `AUTHORIZATION-POLICY.md`).

## Licença

[MIT](./LICENSE) para o código. Isso não é uma autorização para usar a
ferramenta contra sites de terceiros sem permissão real — ver
[AUTHORIZATION-POLICY.md](./AUTHORIZATION-POLICY.md).
