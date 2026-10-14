param(
    [string]$Version
)

$ErrorActionPreference = "Stop"

function Get-Sha256Hex {
    param([string]$Path)

    $stream = [System.IO.File]::OpenRead($Path)
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([System.BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $algorithm.Dispose()
        $stream.Dispose()
    }
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$tauriConfigPath = Join-Path $repositoryRoot "src-tauri\tauri.conf.json"
$tauriConfig = Get-Content -LiteralPath $tauriConfigPath -Raw | ConvertFrom-Json
if (-not $Version) {
    $Version = [string]$tauriConfig.version
}

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Invalid release version: $Version"
}

$releaseRoot = Join-Path $repositoryRoot "release\v$Version"
$portableRoot = Join-Path $releaseRoot "portable"
$executablePath = Join-Path $repositoryRoot "src-tauri\target\release\desktop-pet.exe"
$installerDirectory = Join-Path $repositoryRoot "src-tauri\target\release\bundle\nsis"
$installer = Get-ChildItem -LiteralPath $installerDirectory -Filter "*${Version}*x64-setup.exe" -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not (Test-Path -LiteralPath $executablePath)) {
    throw "Release executable not found: $executablePath"
}
if (-not $installer) {
    throw "NSIS x64 installer for v$Version was not found in $installerDirectory"
}

if (Test-Path -LiteralPath $releaseRoot) {
    $resolvedReleaseRoot = [System.IO.Path]::GetFullPath($releaseRoot)
    $allowedRoot = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot "release"))
    if (-not $resolvedReleaseRoot.StartsWith($allowedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to clean a release path outside the repository release directory."
    }
    Remove-Item -LiteralPath $releaseRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $portableRoot -Force | Out-Null
Copy-Item -LiteralPath $executablePath -Destination (Join-Path $portableRoot "Desktop-Pet.exe")

$portableReadme = @"
Desktop Pet v$Version - Windows x64 portable edition

1. Extract the complete ZIP archive before running Desktop-Pet.exe.
2. Microsoft Edge WebView2 Runtime is required.
3. Settings and Todo data are stored in .desktop-pet-data beside the executable when the directory is writable.
4. Right-click the pet or tray icon and choose Exit to close the application.

Project: https://github.com/baichenliu1/desktop-pet
"@
[System.IO.File]::WriteAllText(
    (Join-Path $portableRoot "README.txt"),
    $portableReadme,
    [System.Text.UTF8Encoding]::new($false)
)

$portableArchive = Join-Path $releaseRoot "desktop-pet-v$Version-windows-x64-portable.zip"
$installerOutput = Join-Path $releaseRoot "desktop-pet-v$Version-windows-x64-setup.exe"
Compress-Archive -Path (Join-Path $portableRoot "*") -DestinationPath $portableArchive -CompressionLevel Optimal
Copy-Item -LiteralPath $installer.FullName -Destination $installerOutput
Remove-Item -LiteralPath $portableRoot -Recurse -Force

$assets = @($installerOutput, $portableArchive)
$checksumLines = foreach ($asset in $assets) {
    $hash = Get-Sha256Hex -Path $asset
    "$hash  $([System.IO.Path]::GetFileName($asset))"
}
[System.IO.File]::WriteAllLines(
    (Join-Path $releaseRoot "SHA256SUMS.txt"),
    $checksumLines,
    [System.Text.UTF8Encoding]::new($false)
)

Get-ChildItem -LiteralPath $releaseRoot -File |
    Sort-Object Name |
    Select-Object Name, Length, LastWriteTime
