$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "Project:" (Get-Location)

Write-Host "`n[1/3] Installing dependencies..."
& npm.cmd install

Write-Host "`n[2/3] Registering slash commands..."
& npm.cmd run register:commands

Write-Host "`n[3/3] Starting bot (dev mode)..."
& npm.cmd run dev

