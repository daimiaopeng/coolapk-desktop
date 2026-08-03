$ErrorActionPreference = 'Stop'

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'Node.js/npm is required. Install Node.js 22 or newer first.'
}

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    $cargoExecutable = Join-Path $env:USERPROFILE '.cargo\bin\cargo.exe'
    if (-not (Test-Path -LiteralPath $cargoExecutable)) {
        throw 'Rust stable is required. Install it from https://rustup.rs/ first.'
    }
    $env:PATH = "$(Split-Path -Parent $cargoExecutable);$env:PATH"
}

Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath 'node_modules')) {
    npm ci
}
npm run tauri dev
