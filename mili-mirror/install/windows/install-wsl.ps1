# install-wsl.ps1 — Prepara WSL 2 + Ubuntu para o nt-site-mirror (Windows).
# Regras obrigatórias (PRD):
#   - Não particiona disco, não configura dual boot, não substitui o Windows.
#   - Não desativa antivírus nem firewall. Não armazena senha.
#   - Privilégios administrativos somente quando necessário; avisa sobre reinicialização.
# Uso: powershell -ExecutionPolicy Bypass -File install/windows/install-wsl.ps1

$ErrorActionPreference = 'Stop'
$LogFile = Join-Path $PSScriptRoot 'install-wsl.log'

function Write-Log([string]$Message) {
    $line = "{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

Write-Log '=== nt-site-mirror: preparação do WSL 2 ==='

# 1. Verifica se WSL já está presente
$wslInstalled = $false
try {
    $null = & wsl.exe --status 2>$null
    $wslInstalled = $true
} catch {
    $wslInstalled = $false
}

if (-not $wslInstalled) {
    Write-Log 'WSL não encontrado. Instalação requer privilégios administrativos e REINICIALIZAÇÃO.'
    $answer = Read-Host 'Instalar WSL 2 + Ubuntu agora? (s/N)'
    if ($answer -ne 's' -and $answer -ne 'S') {
        Write-Log 'Instalação cancelada pelo usuário.'
        exit 0
    }
    Write-Log 'Executando: wsl --install -d Ubuntu'
    & wsl.exe --install -d Ubuntu
    Write-Log 'Após a conclusão, REINICIALIZE o Windows e rode este script novamente.'
    exit 0
}

# 2. Atualiza e fixa versão 2
Write-Log 'Atualizando WSL...'
& wsl.exe --update
Write-Log 'Definindo WSL 2 como padrão...'
& wsl.exe --set-default-version 2

# 3. Verifica distribuição Ubuntu
$distros = (& wsl.exe --list --quiet) -join ' '
if ($distros -notmatch 'Ubuntu') {
    Write-Log 'Ubuntu não encontrado. Instalando...'
    & wsl.exe --install -d Ubuntu
    Write-Log 'Conclua a criação do usuário no terminal do Ubuntu e rode este script novamente.'
    exit 0
}

& wsl.exe --list --verbose | Out-String | ForEach-Object { Write-Log $_ }

# 4. Bootstrap dentro do Ubuntu (sem senha armazenada; sudo interativo do próprio usuário)
Write-Log 'Executando bootstrap do Linux dentro do Ubuntu...'
$skillWslPath = & wsl.exe -d Ubuntu -- wslpath -a ($PSScriptRoot -replace '\\','/' -replace '^([A-Za-z]):', {'/mnt/' + $Matches[1].ToLower()}) 2>$null
Write-Log "Caminho da skill no WSL: $skillWslPath"
Write-Log 'Rode no Ubuntu:  cd <nt-site-mirror> && bash install/linux/install.sh'
Write-Log '=== Preparação concluída. Log em: '"$LogFile"' ==='
