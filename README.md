# 伴聊悬浮舱 (Context-Pod)

一款专为中国职场与高频社交场景设计的**纯桌面端、全本地隐私保护**的 AI Copilot 智能体。

## 核心功能

- **幽灵潜伏**：在微信、企业微信、钉钉等 PC 客户端聊天时，按下 `Alt+Space`，悬浮窗瞬间弹出
- **无感抓取**：50ms 内通过剪贴板通道自动读取输入框文字及前文上下文
- **本地溯源**：在本地向量库中检索对方姓名，提取已存储的性格画像和记忆
- **多模型支持**：DeepSeek、OpenAI、通义千问等任意兼容 OpenAI 格式的大模型
- **推演涌现**：通过多阶段工作流，生成三种高情商回复策略（顺从推进 / 委婉甩锅 / 幽默化解）
- **一键注入**：点击选择方案，悬浮窗消失，文字无缝注入原聊天输入框

## 技术架构

```
┌─────────────────────────────────────────┐
│           Tauri v2 桌面基座              │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │  Rust(enigo) │  │  Vue 3 + Vite 前端 │  │
│  │  键盘模拟    │  │  TailwindCSS 毛玻璃  │  │
│  └─────────────┘  └──────────────────┘  │
│  ┌─────────────────────────────────────┐│
│  │  本地服务层（全浏览器端运行）           ││
│  │  Transformers.js → 向量嵌入          ││
│  │  Orama → 本地向量 + 全文搜索          ││
│  │  AI SDK → DeepSeek/OpenAI/Qwen API  ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

## 技术栈

| 模块 | 选型 |
|------|------|
| 桌面基座 | Tauri v2 |
| 前端框架 | Vue 3 (Composition API) + Vite |
| CSS | TailwindCSS（毛玻璃无边框 UI） |
| 状态管理 | Pinia |
| LLM | DeepSeek / OpenAI / 通义千问 (API) |
| AI 应用层 | Vercel AI SDK (`@ai-sdk/openai`) |
| 本地向量搜索 | Orama |
| 本地 Embedding | Transformers.js (WebGPU/WASM) |
| 键盘模拟 | enigo (Rust) |

## 项目结构

```
src/
├── composables/
│   ├── useCapture.ts         # 全局快捷键 + 剪贴板抓取
│   └── useWindowManager.ts   # 窗口显示/隐藏/切换
├── services/
│   ├── memoryService.ts       # Orama + Transformers.js 本地 RAG
│   ├── agentWorkflow.ts       # 工作流（提取→检索→生成）
│   └── llmService.ts          # 多提供商 LLM API 调用
├── components/
│   ├── FloatingPanel.vue      # 悬浮窗主面板
│   ├── ReplyCard.vue          # 回复策略卡片（A/B/C）
│   ├── ContactManager.vue     # 联系人性格档案管理
│   └── SettingsPanel.vue      # 提供商/API Key 等配置
├── stores/
│   ├── appStore.ts            # 全局状态（工作流阶段等）
│   └── contactStore.ts        # 联系人数据持久化
└── types/index.ts             # TypeScript 类型定义

src-tauri/
├── src/lib.rs                 # Rust 键盘宏（Ctrl+A/C/V）
└── tauri.conf.json            # 透明/置顶/无边框窗口配置
```

## 快速开始

### 环境要求

- Node.js >= 18
- Rust >= 1.70
- Windows 10/11

### 安装依赖

```bash
npm install
```

### 配置（推荐使用内置设置面板）

运行后打开应用，在设置面板中选择：
- **大模型提供商**：DeepSeek / OpenAI / 通义千问 / 自定义
- **API Key**：对应提供商的密钥
- **Base URL**：自动根据提供商填充，也可自定义
- **模型名称**：自动默认填充，也可自定义

### 开发模式

```bash
# 前端热重载预览（无 Tauri 窗口）
npm run dev

# 完整 Tauri 桌面应用开发
npm run tauri:dev
```

### 构建生产版本

```bash
npm run tauri:build
```

构建产物位于 `src-tauri/target/release/bundle/`。

### 一键安装脚本

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
```

## 使用流程

1. **添加联系人**：点击右上角联系人图标，录入对方的姓名和性格特点（如"王总：脾气急躁，爱画大饼"）
2. **唤醒悬浮窗**：在任何 PC 聊天软件中，输入回复内容（不敲回车），按下 `Alt+Space`
3. **等待推演**：悬浮窗显示工作流进度（识别对话对象 → 检索记忆档案 → 生成回复策略）
4. **选择注入**：显示三种策略（A 顺从 / B 甩锅 / C 幽默），点击即注入到输入框

## 测试

```bash
# 运行所有测试
npm run test

# 带覆盖率报告
npm run test:coverage
```

当前测试覆盖：46 个测试用例，覆盖 services 层、composables 层、Vue 组件层、Pinia Store 层。

## 数据隐私

- 所有联系人性格档案和向量数据**存储在本地** localStorage
- Embedding 模型通过 Transformers.js 在浏览器 WebGPU/WASM 环境下**本地运行**
- 仅有 LLM 对话内容经由云端 API 处理，聊天记录本身不离开本地

## CI/CD

GitHub Actions 流水线（见 `.github/workflows/ci.yml`）：

1. Lint & TypeCheck — `vue-tsc --noEmit`
2. Unit & Integration Tests — `vitest` + 覆盖率检查
3. Build Tauri App — Rust 编译 + 前端打包 + 产物上传

## License

MIT
