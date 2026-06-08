<#
.SYNOPSIS
  Packages the built Tauri app (monet.exe) into an MSIX for the Microsoft Store.

.DESCRIPTION
  Stages monet.exe + visual assets + a generated AppxManifest.xml, then runs
  makeappx.exe from the Windows SDK to produce a .msix.

  For STORE SUBMISSION: run WITHOUT -Sign. The Microsoft Store re-signs the
  package for free, so you do not need a paid code-signing certificate. The
  Identity values below MUST match exactly what Partner Center reserved for you
  (Partner Center > your app > Product management > Product identity).

  For LOCAL TESTING (sideload): run WITH -Sign. This creates a throwaway
  self-signed certificate, signs the package, and prints how to trust+install
  it. This cert is only valid on your machine and is NOT used for the Store.

.EXAMPLE
  # Build a Store-ready package (real identity from Partner Center, unsigned):
  ./build-msix.ps1 -IdentityName "1234Publisher.Monetnotes" `
                   -Publisher "CN=ABCDEFAB-1234-5678-90AB-CDEF12345678" `
                   -PublisherDisplayName "Your Publisher Name"

.EXAMPLE
  # Build + self-sign for local testing only:
  ./build-msix.ps1 -Sign
#>

[CmdletBinding()]
param(
  # Package/Identity/Name from Partner Center (Product identity page).
  [string]$IdentityName = "LuizVilarinho.Monetnotes",

  # Package/Identity/Publisher from Partner Center, e.g. "CN=ABCD...-...".
  [string]$Publisher = "CN=C2845101-6356-48E5-B990-5F01E6C1547F",

  # Package/Properties/PublisherDisplayName from Partner Center.
  [string]$PublisherDisplayName = "Luiz Vilarinho",

  # 4-part version x.y.z.0. Defaults to tauri.conf.json version with revision 0.
  [string]$Version = "",

  # Sign with a throwaway self-signed cert for LOCAL sideload testing only.
  [switch]$Sign
)

$ErrorActionPreference = "Stop"

# --- Resolve paths -----------------------------------------------------------
$msixDir   = $PSScriptRoot                              # src-tauri\msix
$srcTauri  = Split-Path $msixDir -Parent                # src-tauri
$repoRoot  = Split-Path $srcTauri -Parent
$exePath   = Join-Path $srcTauri "target\release\monet.exe"
$iconsDir  = Join-Path $srcTauri "icons"
$confPath  = Join-Path $srcTauri "tauri.conf.json"
$template  = Join-Path $msixDir "AppxManifest.template.xml"
$outDir    = Join-Path $srcTauri "target\msix"
$stageDir  = Join-Path $outDir "stage"

if (-not (Test-Path $exePath)) {
  throw "monet.exe not found at $exePath. Run 'npm run tauri:build' first."
}

# --- Locate Windows SDK tools ------------------------------------------------
$kit = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin" -Directory |
  Where-Object { Test-Path (Join-Path $_.FullName "x64\makeappx.exe") } |
  Sort-Object Name -Descending | Select-Object -First 1
if (-not $kit) { throw "makeappx.exe not found. Install the Windows 10/11 SDK." }
$makeappx = Join-Path $kit.FullName "x64\makeappx.exe"
$signtool = Join-Path $kit.FullName "x64\signtool.exe"
Write-Host "Using SDK tools from: $($kit.FullName)\x64" -ForegroundColor DarkGray

# --- Resolve version (force 4-part, revision = 0) ----------------------------
if (-not $Version) {
  $conf = Get-Content $confPath -Raw | ConvertFrom-Json
  $parts = @($conf.version -split '\.')
  while ($parts.Count -lt 3) { $parts += "0" }
  $Version = "{0}.{1}.{2}.0" -f $parts[0], $parts[1], $parts[2]
}
Write-Host "Package version: $Version" -ForegroundColor DarkGray

# --- Stage files -------------------------------------------------------------
if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }
New-Item -ItemType Directory -Path $stageDir | Out-Null
$assetsDir = Join-Path $stageDir "Assets"
New-Item -ItemType Directory -Path $assetsDir | Out-Null

Copy-Item $exePath (Join-Path $stageDir "monet.exe")

$assets = @(
  "Square44x44Logo.png", "Square71x71Logo.png", "Square150x150Logo.png",
  "StoreLogo.png"
)
foreach ($a in $assets) {
  $p = Join-Path $iconsDir $a
  if (-not (Test-Path $p)) { throw "Missing asset $a in $iconsDir (run 'npm run tauri icon')." }
  Copy-Item $p (Join-Path $assetsDir $a)
}

# --- Generate AppxManifest.xml from template ---------------------------------
$manifest = Get-Content $template -Raw
$manifest = $manifest.Replace("{{IDENTITY_NAME}}", $IdentityName)
$manifest = $manifest.Replace("{{PUBLISHER}}", $Publisher)
$manifest = $manifest.Replace("{{PUBLISHER_DISPLAY_NAME}}", $PublisherDisplayName)
$manifest = $manifest.Replace("{{VERSION}}", $Version)
$manifestOut = Join-Path $stageDir "AppxManifest.xml"
# UTF-8 without BOM (makeappx is picky about the BOM on the manifest).
[System.IO.File]::WriteAllText($manifestOut, $manifest, (New-Object System.Text.UTF8Encoding($false)))

# --- Pack --------------------------------------------------------------------
$msixName = "MonetNotes_${Version}_x64.msix"
$msixPath = Join-Path $outDir $msixName
if (Test-Path $msixPath) { Remove-Item $msixPath -Force }

& $makeappx pack /d $stageDir /p $msixPath /o
if ($LASTEXITCODE -ne 0) { throw "makeappx failed with exit code $LASTEXITCODE" }
Write-Host "`nMSIX created: $msixPath" -ForegroundColor Green

# --- Optional self-sign for local testing ------------------------------------
if ($Sign) {
  Write-Host "`nSelf-signing for LOCAL testing (not for the Store)..." -ForegroundColor Yellow
  $cert = New-SelfSignedCertificate -Type Custom -Subject $Publisher `
    -KeyUsage DigitalSignature -FriendlyName "Monet Notes MSIX test cert" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")

  & $signtool sign /fd SHA256 /sha1 $cert.Thumbprint $msixPath
  if ($LASTEXITCODE -ne 0) { throw "signtool failed with exit code $LASTEXITCODE" }

  $cerPath = Join-Path $outDir "MonetNotesTest.cer"
  Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null

  Write-Host "`nSigned. To trust + install locally (run as Administrator):" -ForegroundColor Green
  Write-Host "  Import-Certificate -FilePath `"$cerPath`" -CertStoreLocation Cert:\LocalMachine\TrustedPeople" -ForegroundColor Cyan
  Write-Host "  Add-AppxPackage -Path `"$msixPath`"" -ForegroundColor Cyan
} else {
  Write-Host "`nUnsigned package ready for Partner Center upload." -ForegroundColor Green
  Write-Host "The Microsoft Store will sign it for you on submission." -ForegroundColor DarkGray
}
