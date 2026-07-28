#!/usr/bin/env bash
# install.sh — Bootstrap do nt-site-mirror em Linux/WSL 2 (Ubuntu).
# Gera log local, não armazena senha e informa como desinstalar.
# Uso: bash install.sh [--dry-run]
#   --dry-run  mostra todos os comandos SEM executar nada (seguro para auditoria)
set -euo pipefail

LOG_FILE="$(dirname "$0")/install.log"
SKILL_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DRY_RUN=0
for arg in "$@"; do
  if [ "$arg" = "--dry-run" ]; then DRY_RUN=1; fi
done

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# run: executa o comando ou apenas o exibe em modo dry-run
run() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

# verify_sha256 <arquivo> <hash_esperado> — aborta se não conferir
verify_sha256() {
  local file="$1" expected="$2" actual
  actual="$(sha256sum "$file" | awk '{print $1}')"
  if [ "$actual" != "$expected" ]; then
    log "ERRO: checksum não confere em $file (esperado $expected, obtido $actual)"
    return 1
  fi
  log "Checksum OK: $file"
}

# need_cmd <nome> — falha claramente quando a ferramenta está ausente
need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "ERRO: ferramenta obrigatória ausente: $1"
    return 1
  fi
}

log "=== nt-site-mirror: bootstrap Linux/WSL ==="
log "Skill root: $SKILL_ROOT"
if [ "$DRY_RUN" = "1" ]; then
  log "MODO DRY-RUN: nenhum comando será executado de fato."
fi

if [ "$DRY_RUN" = "0" ]; then
  need_cmd apt-get || { log "Este script cobre Ubuntu/Debian. Em outra distro, instale manualmente: git curl wget unzip jq ca-certificates build-essential python3 ffmpeg imagemagick sqlite3 nodejs>=18"; exit 1; }
  need_cmd curl
  need_cmd sha256sum
fi

log "Atualizando pacotes (sudo interativo — sua senha NÃO é armazenada)..."
run sudo apt-get update
run sudo apt-get install -y \
  git curl wget unzip jq ca-certificates build-essential \
  python3 python3-venv python3-pip ffmpeg imagemagick sqlite3

if ! command -v node >/dev/null 2>&1 || [ "$(node -v 2>/dev/null | cut -dv -f2 | cut -d. -f1 || echo 0)" -lt 18 ]; then
  log "Instalando Node.js LTS via NodeSource..."
  if [ "$DRY_RUN" = "1" ]; then
    echo "[dry-run] curl -fsSL https://deb.nodesource.com/setup_lts.x -o /tmp/nodesource_setup.sh"
    echo "[dry-run] verify_sha256 /tmp/nodesource_setup.sh \$EXPECTED_NODESOURCE_SHA256 (obrigatório)"
    echo "[dry-run] sudo -E bash /tmp/nodesource_setup.sh"
    echo "[dry-run] sudo apt-get install -y nodejs"
  else
    : "${EXPECTED_NODESOURCE_SHA256:?Defina EXPECTED_NODESOURCE_SHA256 para verificar o script de instalação do Node (política de checksum).}"
    run curl -fsSL https://deb.nodesource.com/setup_lts.x -o /tmp/nodesource_setup.sh
    verify_sha256 /tmp/nodesource_setup.sh "$EXPECTED_NODESOURCE_SHA256"
    run sudo -E bash /tmp/nodesource_setup.sh
    run sudo apt-get install -y nodejs
  fi
fi

log "Node: $(node -v 2>/dev/null || echo 'ausente') | npm: $(npm -v 2>/dev/null || echo 'ausente')"

log "Instalando dependências do projeto..."
if [ "$DRY_RUN" = "1" ]; then
  echo "[dry-run] cd $SKILL_ROOT && npm ci (ou npm install)"
  echo "[dry-run] npx playwright install --with-deps chromium"
else
  cd "$SKILL_ROOT"
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
  npx playwright install --with-deps chromium
fi

if [ "$DRY_RUN" = "0" ]; then
  {
    echo "node=$(node -v)"
    echo "npm=$(npm -v)"
    echo "chromium=$(node -e "import('playwright').then(async p=>{const b=await p.chromium.launch();console.log(b.version());await b.close()})" 2>/dev/null || echo missing)"
    echo "installedAt=$(date -Iseconds)"
  } > "$SKILL_ROOT/runtime-versions.lock"
fi

log "=== Bootstrap concluído (dry-run=$DRY_RUN). ==="
log "Para desinstalar: remova a pasta '$SKILL_ROOT' e, opcionalmente, 'rm -rf ~/.cache/ms-playwright'."
log "Valide com: node scripts/doctor.js"
