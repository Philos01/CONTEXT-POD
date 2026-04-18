﻿﻿﻿﻿# 伴聊悬浮舱 (Context-Pod) 一键安装与启动脚本
# 用法: powershell -ExecutionPolicy Bypass -File scripts/setup.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  伴聊悬浮舱 (Context-Pod) 安装脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check prerequisites
Write-Host "[1/7] 检查系统环境..." -ForegroundColor Yellow

try { $nodeVer = node --version; Write-Host "  Node.js: $nodeVer" -ForegroundColor Green } catch { Write-Host "  Node.js: 未安装" -ForegroundColor Red; exit 1 }
try { $npmVer = npm --version; Write-Host "  npm: $npmVer" -ForegroundColor Green } catch { Write-Host "  npm: 未安装" -ForegroundColor Red; exit 1 }
try { $rustVer = rustc --version; Write-Host "  Rust: $rustVer" -ForegroundColor Green } catch { Write-Host "  Rust: 未安装" -ForegroundColor Red; exit 1 }
try { $cargoVer = cargo --version; Write-Host "  Cargo: $cargoVer" -ForegroundColor Green } catch { Write-Host "  Cargo: 未安装" -ForegroundColor Red; exit 1 }

# Step 2: Check Rust version >= 1.85
Write-Host ""
Write-Host "[2/7] 检查 Rust 版本兼容性..." -ForegroundColor Yellow
$rustVersionOutput = (rustc --version 2>$null).ToString()
$rustMajor = 0
$rustMinor = 0
if ($rustVersionOutput.Contains(".")) {
    $parts = $rustVersionOutput.Split(" ")
    foreach ($p in $parts) {
        if ($p.Contains(".") -and $p.Length -ge 5) {
            $verParts = $p.Split(".")
            try { $rustMajor = [int]$verParts[0] } catch {}
            try { $rustMinor = [int]$verParts[1] } catch {}
            break
        }
    }
}
if ($rustMajor -lt 1 -or ($rustMajor -eq 1 -and $rustMinor -lt 85)) {
    Write-Host "  当前 Rust 版本过低 (需要 >= 1.85.0)" -ForegroundColor Red
    Write-Host "  正在升级 Rust 工具链..." -ForegroundColor Yellow
    rustup update stable
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  升级失败，请手动运行: rustup update stable" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Rust 已升级" -ForegroundColor Green
} else {
    Write-Host "  Rust 版本满足要求 (>= 1.85.0)" -ForegroundColor Green
}

# Step 3: Install npm dependencies
Write-Host ""
Write-Host "[3/7] 安装前端依赖..." -ForegroundColor Yellow
Set-Location $ProjectRoot
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: npm install 失败" -ForegroundColor Red
    exit 1
}

# Step 4: Create .env from template if not exists
Write-Host ""
Write-Host "[4/7] 配置环境变量..." -ForegroundColor Yellow
if (-not (Test-Path "$ProjectRoot\.env")) {
    Copy-Item "$ProjectRoot\.env.example" "$ProjectRoot\.env"
    Write-Host "  已创建 .env 文件，请编辑填入 API Key" -ForegroundColor Green
} else {
    Write-Host "  .env 文件已存在" -ForegroundColor Green
}

# Step 5: Generate icons if missing
Write-Host ""
Write-Host "[5/7] 初始化资源目录..." -ForegroundColor Yellow
$iconsDir = "$ProjectRoot\src-tauri\icons"
if (-not (Test-Path "$iconsDir\icon.png")) {
    New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
    Write-Host "  已创建 icons 目录" -ForegroundColor Green
} else {
    Write-Host "  图标文件已存在" -ForegroundColor Green
}

# Step 6: Build frontend
Write-Host ""
Write-Host "[6/7] 构建前端..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "警告: 前端构建失败，将在开发模式下运行" -ForegroundColor Yellow
}

# Step 7: Run tests
Write-Host ""
Write-Host "[7/7] 运行测试..." -ForegroundColor Yellow
npm run test
if ($LASTEXITCODE -ne 0) {
    Write-Host "警告: 部分测试未通过" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  安装完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步操作：" -ForegroundColor White
Write-Host "  1. 编辑 .env 文件，填入 API Key" -ForegroundColor White
Write-Host "  2. 开发模式: npm run tauri:dev" -ForegroundColor White
Write-Host "  3. 生产构建: npm run tauri:build" -ForegroundColor White
Write-Host ""
