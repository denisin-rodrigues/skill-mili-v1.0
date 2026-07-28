# install-wsl.ps1 — Prepara WSL 2 + Ubuntu para o nt-site-mirror (Windows).
# Regras obrigatórias (PRD):
#   - Não particiona disco, não configura dual boot, não substitui o Windows.
#   - Não desativa antivírus nem firewall. Não armazena senha.
#   - Privilégios administrativos somente quando necessário; avisa sobre reinicialização.
# Uso: powershell -ExecutionPolicy Bypass -File install/windows/install-wsl.ps1 [-DryRun]
#   -DryRun  mostra todas as ações SEM executar nada (seguro para auditoria)
[CmdletBinding()]
param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$LogFile = Join-Path $PSScriptRoot 'install-wsl.log'

function Write-Log([string]$Message) {
    $line = "{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Write-Host $line
    Add-Content -Path $LogFile -Value $Message
}

function Test-Checksum {
    <#
    .SYNOPSIS
    Verifica SHA-256 de um arquivo baixado. Retorna $false quando não confere.
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Expected
    )
    $actual = (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $Expected.ToLowerInvariant()) {
        Write-Log "ERRO: checksum não confere em $Path (esperado $Expected, obtido $actual)"
        return $false
    }
    Write-Log "Checksum OK: $Path"
    return $true
}

function Invoke-Step {
    <#
    .SYNOPSIS
    Executa a ação ou apenas a exibe em modo -DryRun.
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )
    if ($DryRun) {
        Write-Log "[dry-run] $Description"
    } else {
        Write-Log $Description
        & $Action
    }
}

function Assert-AdminRights([string]$ActionDescription) {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Log "PRIVILÉGIO ADMINISTRATIVO necessário para: $ActionDescription"
        Write-Log 'Reexecute este script em um terminal elevado (nenhuma senha é armazenada).'
        return $false
    }
    return $true
}

Write-Log "=== nt-site-mirror: preparação do WSL 2 (DryRun=$DryRun) ==="

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
    if (-not $DryRun) {
        if (-not (Assert-AdminRights 'wsl --install -d Ubuntu')) { exit 2 }
        $answer = Read-Host 'Instalar WSL 2 + Ubuntu agora? (s/N)'
        if ($answer -ne 's' -and $answer -ne 'S') {
            Write-Log 'Instalação cancelada pelo usuário.'
            exit 0
        }
    }
    Invoke-Step 'wsl --install -d Ubuntu' { & wsl.exe --install -d Ubuntu }
    Write-Log 'Após a conclusão, REINICIALIZE o Windows e rode este script novamente.'
    exit 0
}

# 2. Atualiza e fixa versão 2
Invoke-Step 'wsl --update' { & wsl.exe --update }
Invoke-Step 'wsl --set-default-version 2' { & wsl.exe --set-default-version 2 }

# 3. Verifica distribuição Ubuntu
$distros = (& wsl.exe --list --quiet 2>$null) -join ' '
if ($distros -notmatch 'Ubuntu') {
    Write-Log 'Ubuntu não encontrado.'
    Invoke-Step 'wsl --install -d Ubuntu' { & wsl.exe --install -d Ubuntu }
    Write-Log 'Conclua a criação do usuário no terminal do Ubuntu e rode este script novamente.'
    exit 0
}

if (-not $DryRun) {
    & wsl.exe --list --verbose | Out-String | ForEach-Object { Write-Log $_ }
} else {
    Write-Log '[dry-run] wsl --list --verbose'
}

# 4. Bootstrap dentro do Ubuntu (sem senha armazenada; sudo interativo do próprio usuário)
Write-Log 'Próximo passo no Ubuntu: cd <nt-site-mirror> && bash install/linux/install.sh'
Write-Log "=== Preparação concluída (DryRun=$DryRun). Log em: $LogFile ==="
