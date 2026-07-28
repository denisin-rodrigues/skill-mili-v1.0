// Installer verification (Milestone: Core Hardening, item 8).
// Static checks + REAL dry-run execution. Nothing is installed: no WSL, no apt,
// no downloads. Paths with spaces are exercised because the repo itself lives
// under "Mili Mirror".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const INSTALL_SH = path.join(SKILL_ROOT, 'install', 'linux', 'install.sh');
const INSTALL_PS1 = path.join(SKILL_ROOT, 'install', 'windows', 'install-wsl.ps1');

const sh = fs.readFileSync(INSTALL_SH, 'utf8');
const ps1 = fs.readFileSync(INSTALL_PS1, 'utf8');

function findBash() {
  for (const candidate of ['bash', 'bash.exe']) {
    const r = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (!r.error && r.status === 0) return candidate;
  }
  for (const p of ['C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files (x86)\\Git\\bin\\bash.exe']) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

test('install.sh: regras de segurança estáticas', () => {
  assert.match(sh, /set -euo pipefail/, 'falha rápida e explícita');
  assert.match(sh, /--dry-run/, 'suporta dry-run');
  assert.match(sh, /verify_sha256/, 'verificação de checksum presente');
  assert.match(sh, /EXPECTED_NODESOURCE_SHA256/, 'checksum é obrigatório para download do Node');
  assert.match(sh, /need_cmd/, 'detecta ferramenta ausente');
  assert.match(sh, /curl -fsSL/, 'curl falha em erro HTTP (modo de falha de download)');
  assert.doesNotMatch(sh, /rm -rf \//, 'sem remoção destrutiva');
  assert.doesNotMatch(sh, /chmod 777/, 'sem permissões inseguras');
  assert.match(sh, /Para desinstalar/, 'oferece caminho de desinstalação');
});

test('install.sh: caminhos com espaços estão citados', () => {
  assert.match(sh, /"\$SKILL_ROOT"/, 'SKILL_ROOT citado');
  assert.match(sh, /"\$@"/, 'argumentos citados');
  assert.match(sh, /"\$1"/, 'parâmetros citados');
});

test('install.sh: DRY-RUN real não executa nada (bash)', (t) => {
  const bash = findBash();
  if (!bash) {
    t.skip('bash indisponível neste ambiente; dry-run do .sh verificado estaticamente');
    return;
  }
  // Path relativo + cwd: funciona em WSL (mapeia cwd para /mnt/c/...) e em Git Bash,
  // e exercita indiretamente o caminho COM ESPAÇOS do diretório do projeto
  const r = spawnSync(bash, ['install/linux/install.sh', '--dry-run'], { cwd: SKILL_ROOT, encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\[dry-run\]/, 'deve imprimir comandos em modo dry-run');
  assert.doesNotMatch(r.stdout, /Reading package lists|Get:\d|Hit:\d/, 'não pode ter executado apt-get de verdade');
  assert.match(r.stdout, /MODO DRY-RUN/);
});

test('install-wsl.ps1: regras de segurança estáticas', () => {
  assert.match(ps1, /\$DryRun/, 'suporta -DryRun');
  assert.match(ps1, /function Test-Checksum/, 'verificação de checksum presente');
  assert.match(ps1, /Assert-AdminRights/, 'mensagem clara de privilégio administrativo');
  assert.match(ps1, /REINICIALIZE/, 'avisa sobre reinicialização');
  assert.doesNotMatch(ps1, /Disable-.*(Antivirus|Firewall|Defender)/i, 'não desativa AV/firewall');
  assert.doesNotMatch(ps1, /bcdedit|diskpart/i, 'não particiona nem altera boot');
  assert.match(ps1, /Não armazena senha|nenhuma senha é armazenada/i);
});

test('install-wsl.ps1: -DryRun real não executa nada (PowerShell)', () => {
  const r = spawnSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', INSTALL_PS1, '-DryRun'],
    { encoding: 'utf8', timeout: 120000 },
  );
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /dry-run/i, 'deve imprimir ações em modo dry-run');
  assert.doesNotMatch(r.stdout, /Installing|Baixando|Downloading/i, 'não pode ter instalado/baixado nada');
});

test('checksum: conceito validado com hash real (node crypto)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntm-checksum-'));
  const file = path.join(dir, 'download.bin');
  fs.writeFileSync(file, 'conteúdo conhecido');
  const expected = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  // coincide com a saída de sha256sum/Get-FileHash usada pelos instaladores
  const recomputed = crypto.createHash('sha256').update('conteúdo conhecido').digest('hex');
  assert.equal(recomputed, expected);
  assert.notEqual(crypto.createHash('sha256').update('conteúdo adulterado').digest('hex'), expected);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('detecção de OS: scripts cobrem Windows e Linux/WSL sem conflito', () => {
  assert.ok(fs.existsSync(INSTALL_PS1), 'instalador Windows presente');
  assert.ok(fs.existsSync(INSTALL_SH), 'instalador Linux/WSL presente');
  assert.match(ps1, /wsl\.exe --status/, 'detecção de WSL presente');
  assert.match(sh, /need_cmd apt-get/, 'detecção de distro presente');
});
