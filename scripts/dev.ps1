# 伴聊悬浮舱 (Context-Pod) 开发启动脚本
# 用法: powershell -ExecutionPolicy Bypass -File scripts/dev.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host ""
Write-Host "启动伴聊悬浮舱开发服务器..." -ForegroundColor Cyan
Write-Host ""

Set-Location $ProjectRoot

if (-not (Test-Path "node_modules")) {
    Write-Host "未检测到依赖，正在安装..." -ForegroundColor Yellow
    npm install
}

npm run tauri:dev
