# Confere (e, com -Source, copia) os sidecars do Mincer (ffmpeg e yt-dlp) em
# src-tauri/binaries/. Os binarios nao sao versionados (licenca GPL e tamanho),
# mas ficam nesse workspace: o build so precisa deles ali. O ffmpeg e o build
# "essentials" 8.1.1 do gyan.dev, GPLv3. Pendencia: baixar das fontes oficiais
# (ver DOCS/backlog.md).
param(
    [string]$Source
)

$ErrorActionPreference = "Stop"

# SHA-256 das versoes conhecidas; trocar a versao de um binario = atualizar aqui.
$expected = @{
    "ffmpeg-x86_64-pc-windows-msvc.exe" = "228d7a8556258de907fdb55f36850078ebc7680b84ec30d84ea02e99bec1d1eb"
    "yt-dlp-x86_64-pc-windows-msvc.exe" = "3db811b366b2da47337d2fcfdfe5bbd9a258dad3f350c54974f005df115a1545"
}

$dest = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")) "src-tauri\binaries"

function Get-Sha256([string]$path) {
    (Get-FileHash -Algorithm SHA256 $path).Hash.ToLower()
}

if ($Source) {
    foreach ($name in $expected.Keys) {
        $from = Join-Path $Source $name
        if (-not (Test-Path $from)) {
            Write-Error "Sidecar not found: $from"
            exit 1
        }
        if ((Get-Sha256 $from) -ne $expected[$name]) {
            Write-Error "Unexpected SHA-256 for $from. Update the hash in this script only if the new version is intended."
            exit 1
        }
    }
    New-Item -ItemType Directory -Force $dest | Out-Null
    foreach ($name in $expected.Keys) {
        Copy-Item (Join-Path $Source $name) (Join-Path $dest $name) -Force
    }
}

$missing = $false
foreach ($name in $expected.Keys) {
    $path = Join-Path $dest $name
    if (-not (Test-Path $path)) {
        Write-Host "Missing: $path"
        $missing = $true
        continue
    }
    if ((Get-Sha256 $path) -ne $expected[$name]) {
        Write-Error "Unexpected SHA-256 for $path."
        exit 1
    }
    $sizeMb = [math]::Round((Get-Item $path).Length / 1MB, 1)
    Write-Host "OK $path ($sizeMb MB)"
}

if ($missing) {
    Write-Error "Sidecars missing in src-tauri\binaries. Run: npm run sidecars -- -Source <folder with the binaries>"
    exit 1
}
