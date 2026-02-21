@echo off
setlocal

rem Usage:
rem   packc3addon.bat [addon_folder] [output_file]
rem Defaults:
rem   addon_folder = scml2
rem   output_file  = scml.c3addon

set "SCRIPT_DIR=%~dp0"

if "%~1"=="" (
	set "ADDON_DIR=%SCRIPT_DIR%scml2"
) else (
	for %%I in ("%~1") do set "ADDON_DIR=%%~fI"
)

if "%~2"=="" (
	set "OUTPUT_FILE=%SCRIPT_DIR%scml.c3addon"
) else (
	for %%I in ("%~2") do set "OUTPUT_FILE=%%~fI"
)

if not exist "%ADDON_DIR%\addon.json" (
	echo [packc3addon] ERROR: addon.json not found in "%ADDON_DIR%".
	exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
	"$ErrorActionPreference='Stop';" ^
	"$addonDir = Resolve-Path '%ADDON_DIR%';" ^
	"$addonJsonPath = Join-Path $addonDir 'addon.json';" ^
	"$addon = Get-Content -Raw $addonJsonPath | ConvertFrom-Json;" ^
	"if (-not $addon.'is-c3-addon') { throw 'addon.json must include is-c3-addon=true.' };" ^
	"if ($addon.'sdk-version' -ne 2) { Write-Warning ('Expected sdk-version 2 for SDK v2 addons. Found: ' + $addon.'sdk-version') };" ^
	"$missing = @();" ^
	"foreach ($relativePath in $addon.'file-list') { if (-not (Test-Path (Join-Path $addonDir $relativePath))) { $missing += $relativePath } };" ^
	"if ($missing.Count -gt 0) { throw ('Missing file-list entries: ' + ($missing -join ', ')) };" ^
	"$dest = [System.IO.Path]::GetFullPath('%OUTPUT_FILE%');" ^
	"$destExt = [System.IO.Path]::GetExtension($dest).ToLowerInvariant();" ^
	"$zipDest = if ($destExt -eq '.zip') { $dest } else { [System.IO.Path]::ChangeExtension($dest, '.zip') };" ^
	"if (Test-Path $dest) { Remove-Item $dest -Force };" ^
	"if (Test-Path $zipDest) { Remove-Item $zipDest -Force };" ^
	"Compress-Archive -Path (Join-Path $addonDir '*') -DestinationPath $zipDest -CompressionLevel Optimal;" ^
	"if ($zipDest -ne $dest) { Move-Item -Path $zipDest -Destination $dest -Force };" ^
	"Write-Host ('[packc3addon] Packed: ' + $dest);"

if errorlevel 1 (
	echo [packc3addon] ERROR: failed to build addon package.
	exit /b 1
)

echo [packc3addon] Done.
exit /b 0
