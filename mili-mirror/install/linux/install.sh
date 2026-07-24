#!/usr/bin/env bash
# install.sh — Bootstrap do nt-site-mirror em Linux/WSL 2 (Ubuntu).
# Gera log local, não armazena senha e informa como desinstalar.
set -euo pipefail

LOG_FILE="$(dirname "$0")/install.log"
SKILL_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== nt-site-mirror: bootstrap Linux/WSL ==="
log "Skill root: $SKILL_ROOT"

if ! command -v apt-get >/dev/null 2>&1; then
  log "ERRO: este script cobre Ubuntu/Debian (apt-get). Em outra distro, instale manualmente:"
  log "git curl wget unzip jq ca-certificates build-essential python3 ffmpeg imagemagick sqlite3 nodejs>=18"
  exit 1
fi

log "Atualizando pacotes (sudo interativo — sua senha NÃO é armazenada)..."
sudo apt-get update 2>&1 | tee -a "$LOG_FILE"
sudo apt-get install -y \
  git curl wget unzip jq ca-certificates build-essential \
  python3 python3-venv python3-pip ffmpeg imagemagick sqlite3 2>&1 | tee -a "$LOG_FILE"

if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 18 ]; then
  log "Instalando Node.js LTS via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - 2>&1 | tee -a "$LOG_FILE"
  sudo apt-get install -y nodejs 2>&1 | tee -a "$LOG_FILE"
fi

log "Node: $(node -v) | npm: $(npm -v)"

cd "$SKILL_ROOT"
log "Instalando dependências do projeto (npm ci ou npm install)..."
if [ -f package-lock.json ]; then
  npm ci 2>&1 | tee -a "$LOG_FILE"
else
  npm install 2>&1 | tee -a "$LOG_FILE"
fi

log "Instalando Chromium do Playwright (com dependências de sistema)..."
npx playwright install --with-deps chromium 2>&1 | tee -a "$LOG_FILE"

{
  echo "node=$(node -v)"
  echo "npm=$(npm -v)"
  echo "chromium=$(node -e "import('playwright').then(async p=>{const b=await p.chromium.launch();console.log(b.version());await b.close()})" 2>/dev/null || echo missing)"
  echo "installedAt=$(date -Iseconds)"
} > "$SKILL_ROOT/runtime-versions.lock"

log "=== Bootstrap concluído. Versões em runtime-versions.lock ==="
log "Para desinstalar: remova a pasta '$SKILL_ROOT' e, opcionalmente, 'rm -rf ~/.cache/ms-playwright'."
log "Valide com: node scripts/doctor.js"
