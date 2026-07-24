# A-002 — EnvironmentBootstrap

**Propósito**: preparar, diagnosticar e registrar o ambiente local.

**Quando atuar**: fase 2, logo após o Guardian aprovar o escopo; também sempre que o usuário
pedir diagnóstico (`ntmirror doctor`) ou bootstrap (`ntmirror bootstrap`).

## Protocolo

```bash
node scripts/doctor.js --config mirror.config.yaml
```

Verifica e registra:

- Node.js ≥ 18, npm, arquitetura e SO (Windows/Linux/macOS, detecção de WSL 2)
- Chromium do Playwright (tenta launch real)
- FFmpeg, Git, Python, Docker (opcionais — avisam, não bloqueiam)
- Espaço em disco (≥ 2 GB) e porta 4173 livre

Saídas: `capture/environment-report.json` e `capture/runtime-versions.lock`.

## Bootstrap (quando o doctor falhar)

- **Linux/WSL**: `bash install/linux/install.sh` — pacotes apt, corepack, `npm ci`,
  `npx playwright install --with-deps chromium`. Registra versões em lock.
- **Windows**: `powershell -File install/windows/install-wsl.ps1` — prepara WSL 2 + Ubuntu.

Regras de instalação (obrigatórias no Windows): não particionar disco, não configurar dual
boot, não substituir o Windows, não desativar antivírus/firewall, não armazenar senha,
pedir privilégios administrativos só quando necessário e avisar quando reinicialização for
necessária.

## Critérios de aceite

- [ ] `environment-report.json` com `ok: true` (checks obrigatórios verdes).
- [ ] Versões registradas em `runtime-versions.lock` (reprodutibilidade).
