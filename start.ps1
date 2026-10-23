# Starts API and web app in two windows.
$root = $PSScriptRoot
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root\server'; npm run dev"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root\client'; npm run dev"
Write-Host "Open http://localhost:5173"
