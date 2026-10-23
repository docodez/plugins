# Re-copies the SDK, the packer and the example plugins from the (private) Docodez repository into this one, so the
# Docodez repository stays the source of truth. Review the changes with `git diff` before committing.
#
#   .\scripts\sync-from-docodez.ps1 -Source W:\path\to\docodez
#
# What it does:
#   - sdk/*.ts and tools/pack.mjs: copied as they are;
#   - examples/<name>: copied without node_modules, dist, out or packages, and with the paths adjusted to this layout
#     (examples are one folder deeper here: ../../sdk -> ../../../sdk, ../tools -> ../../tools, ../sdk -> ../../sdk).
param(
    [Parameter(Mandatory = $true)][string]$Source,
    [string[]]$Examples = @('shopping-list', 'spreadsheet', 'viewer-3d', 'car-log', 'invoice', 'ai-claude', 'ai-groq', 'ai-litellm', 'ai-ollama', 'ai-openai')
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$plugins = Join-Path $Source 'plugins'
if (-not (Test-Path (Join-Path $plugins 'sdk\docodez.d.ts'))) { throw "No Docodez plugins folder at $plugins" }

function Copy-Tree([string]$from, [string]$to) {
    # CI runs `npm ci`, which needs package-lock.json: keep ours when the source has none.
    $lock = Join-Path $to 'package-lock.json'
    $keptLock = if ((Test-Path $lock) -and -not (Test-Path (Join-Path $from 'package-lock.json'))) { [IO.File]::ReadAllBytes($lock) } else { $null }
    if (Test-Path $to) { Remove-Item $to -Recurse -Force }
    New-Item -ItemType Directory -Force $to | Out-Null
    Get-ChildItem $from -Recurse -File | Where-Object {
        $_.FullName -notmatch '\\(node_modules|dist|out)\\' -and $_.Extension -ne '.dczp'
    } | ForEach-Object {
        $target = Join-Path $to $_.FullName.Substring($from.Length + 1)
        New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
        Copy-Item $_.FullName $target
    }
    if ($keptLock) { [IO.File]::WriteAllBytes($lock, $keptLock) }
}

function Set-Paths([string]$file, [hashtable]$replacements) {
    $text = [IO.File]::ReadAllText($file)
    $new = $text
    foreach ($key in $replacements.Keys) { $new = $new.Replace($key, $replacements[$key]) }
    if ($new -ne $text) { [IO.File]::WriteAllText($file, $new, [Text.UTF8Encoding]::new($false)) }
}

# SDK and tools
foreach ($f in 'docodez.d.ts', 'docodez-dev.ts', 'picker.ts') { Copy-Item (Join-Path $plugins "sdk\$f") (Join-Path $repo "sdk\$f") -Force }
Copy-Item (Join-Path $plugins 'tools\pack.mjs') (Join-Path $repo 'tools\pack.mjs') -Force

# Examples
foreach ($name in $Examples) {
    $from = Join-Path $plugins $name
    if (-not (Test-Path $from)) { Write-Warning "Skipped $name (not in $plugins)"; continue }
    $to = Join-Path $repo "examples\$name"
    Copy-Tree $from $to
    Get-ChildItem $to -Recurse -File -Include *.ts, *.tsx, *.js, *.mjs | ForEach-Object { Set-Paths $_.FullName @{ "'../../sdk/" = "'../../../sdk/" } }
    $tsconfig = Join-Path $to 'tsconfig.json'
    if (Test-Path $tsconfig) { Set-Paths $tsconfig @{ '"../sdk"' = '"../../sdk"' } }
    $package = Join-Path $to 'package.json'
    if (Test-Path $package) { Set-Paths $package @{ 'node ../tools/pack.mjs' = 'node ../../tools/pack.mjs' } }
    Write-Host "Synced examples\$name"
}

Write-Host 'Done. Review with: git diff --stat'
