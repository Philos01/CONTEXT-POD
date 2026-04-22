# 🛸 伴聊悬浮舱 (Context-Pod)

<div align="center">

**AI 驱动的智能聊天助手，让每一次回复都恰到好处**

[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue?logo=tauri)](https://tauri.app/)
[![Vue](https://img.shields.io/badge/Vue-3.4-green?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 📖 目录

- [功能特性](#-功能特性)
- [快速开始](#-快速开始)
- [安装指南](#-安装指南)
- [使用教程](#-使用教程)
- [核心功能](#-核心功能)
- [技术架构](#-技术架构)
- [配置说明](#-配置说明)
- [常见问题](#-常见问题)
- [开发指南](#-开发指南)
- [贡献指南](#-贡献指南)

---

## ✨ 功能特性

### 🎯 核心功能

| 功能 | 描述 |
|------|------|
| **智能回复生成** | 基于聊天上下文，AI 自动生成三种高情商回复策略 |
| **联系人记忆** | 为每个联系人建立性格档案，回复更具针对性 |
| **风格画像** | 提取聊天风格，让 AI 模仿你的说话方式 |
| **上下文感知** | 记住历史对话，回复连贯自然 |
| **全局快捷键** | 一键唤醒，无需切换窗口 |

### 🎭 风格提取系统

- **小样本学习**：只需 10-20 条聊天记录，AI 即可提取聊天风格
- **五维分析**：断句排版、口癖语气、情绪风格、词汇特征、标点习惯
- **赛博捏脸**：3 个场景题快速建立你的风格画像

### 🔒 隐私安全

- **本地存储**：所有数据存储在本地，不上传服务器
- **API Key 安全**：仅存储在用户设备，不经过任何中间服务器
- **开源透明**：代码完全开源，可自行审计

---

## 🚀 快速开始

### 环境要求

| 依赖 | 版本要求 |
|------|----------|
| Node.js | >= 18.0 |
| Rust | >= 1.70 |
| pnpm/npm | 最新版 |

### 一键启动

```bash
# 克隆项目
git clone https://github.com/your-username/context-pod.git
cd context-pod

# 安装依赖
npm install

# 启动开发模式
npm run tauri:dev
```

---

## 📦 安装指南

### 方式一：下载安装包

前往 [Releases](https://github.com/your-username/context-pod/releases) 页面下载对应平台的安装包：

| 平台 | 文件格式 |
|------|----------|
| Windows | `.msi` / `.exe` |
| macOS | `.dmg` / `.app` |
| Linux | `.deb` / `.AppImage` |

### 方式二：从源码构建

```bash
# 1. 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. 安装 Node.js (推荐使用 nvm)
nvm install 18
nvm use 18

# 3. 克隆并安装
git clone https://github.com/your-username/context-pod.git
cd context-pod
npm install

# 4. 开发模式
npm run tauri:dev

# 5. 构建生产版本
npm run tauri:build
```

---

## 📚 使用教程

### 第一步：配置 API

1. 启动应用后，点击右上角 **⚙️ 设置** 图标
2. 选择大模型提供商（DeepSeek / OpenAI / 通义千问）
3. 输入 API Key
4. 选择模型（推荐 `deepseek-chat` 或 `gpt-4o-mini`）
5. 点击 **保存设置**

### 第二步：添加联系人

1. 点击 **👥 联系人** 图标
2. 点击 **+ 添加联系人**
3. 填写信息：
   - **姓名**：对方在聊天中显示的名称
   - **性格特点**：如"领导、严肃、喜欢简洁汇报"
   - **标签**：如"工作、上级"

### 第三步：提取风格（可选）

**方式一：从聊天记录提取**
1. 在微信中框选对方 10-20 条聊天记录
2. `Ctrl+C` 复制
3. 点击 **🎭 提取风格**
4. 粘贴聊天记录，选择联系人
5. 点击 **开始提取风格**

**方式二：赛博捏脸测试**
1. 点击 **🧬 赛博捏脸**
2. 选择你的 MBTI 人格
3. 回答 3 个场景题
4. AI 自动生成你的风格画像

### 第四步：开始使用

1. 在微信中选中聊天文字
2. 按 `Ctrl+C` 复制
3. 按 `Alt+Space`（或自定义快捷键）唤醒
4. 选择合适的回复策略
5. 自动复制到剪贴板

---

## 🔧 核心功能

### 1. 智能回复生成

AI 根据以下信息生成回复：

```
┌─────────────────────────────────────────┐
│           Prompt 组成结构               │
├─────────────────────────────────────────┤
│ 1. 联系人名称                           │
│ 2. 性格档案（来自向量数据库）            │
│ 3. 风格画像（来自风格提取）              │
│ 4. 历史对话（最近 10 条）               │
│ 5. 当前聊天上下文                       │
└─────────────────────────────────────────┘
```

**三种回复策略：**

| 策略 | 风格 | 适用场景 |
|------|------|----------|
| A | 顺从推进 | 积极响应、快速执行 |
| B | 委婉甩锅 | 缓冲时间、留有余地 |
| C | 幽默化解 | 轻松氛围、化解尴尬 |

### 2. 联系人记忆系统

**数据结构：**
```typescript
interface Contact {
  id: string;           // 唯一标识
  name: string;         // 联系人姓名
  personality: string;  // 性格特点描述
  tags: string[];       // 标签
  createdAt: number;    // 创建时间
  updatedAt: number;    // 更新时间
}
```

**向量检索：**
- 使用 **Orama** 嵌入式向量数据库
- **Xenova/all-MiniLM-L6-v2** 模型生成 384 维向量
- 相似度阈值 0.3，确保精准匹配

### 3. 风格画像系统

**五维分析：**

| 维度 | 说明 |
|------|------|
| 断句排版 | 长段落 vs 短句连发 |
| 口癖语气 | 常用语气词（哈、呢、呗） |
| 情绪风格 | 高热量/低热量/阴阳怪气 |
| 词汇特征 | 英文/缩写/黑话 |
| 标点习惯 | 波浪号/感叹号/句号 |

**示例输出：**
```json
{
  "sentenceStyle": "喜欢把一句话拆成好几条短句连发",
  "catchphrases": ["收到", "好的", "嗯"],
  "emotionLevel": "低热量，高冷极简",
  "vocabFeatures": "喜欢用互联网黑话",
  "punctuationHabits": "全网句号结尾",
  "summary": "高冷领导风，短句为主"
}
```

### 4. 提示词管理

- 查看和编辑所有系统提示词
- 支持变量插值（如 `{targetPerson}`）
- 修改后立即生效，无需重启

### 5. 日志系统

**日志级别：**
- 🔍 DEBUG：详细调试信息
- ℹ️ INFO：正常操作记录
- ⚠️ WARNING：警告信息
- ❌ ERROR：错误信息

**功能：**
- 实时刷新
- 分级筛选
- 全文搜索
- 导出日志

---

## 🏗️ 技术架构

### 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2.0 |
| 前端框架 | Vue 3.4 + TypeScript |
| 状态管理 | Pinia |
| 样式方案 | TailwindCSS |
| 向量数据库 | Orama |
| 嵌入模型 | Xenova/all-MiniLM-L6-v2 |
| LLM SDK | Vercel AI SDK |

### 项目结构

```
context-pod/
├── src/                      # 前端源码
│   ├── components/           # UI 组件
│   │   ├── FloatingPanel.vue    # 主面板
│   │   ├── ContactManager.vue   # 联系人管理
│   │   ├── SettingsPanel.vue    # 设置面板
│   │   ├── StyleExtractor.vue   # 风格提取
│   │   ├── PersonaQuiz.vue      # 赛博捏脸
│   │   ├── PromptManager.vue    # 提示词管理
│   │   └── LogViewer.vue        # 日志查看
│   ├── services/             # 业务服务
│   │   ├── agentWorkflow.ts     # 工作流引擎
│   │   ├── llmService.ts        # LLM 服务
│   │   ├── memoryService.ts     # 记忆服务
│   │   ├── personaService.ts    # 风格画像
│   │   ├── promptService.ts     # 提示词
│   │   └── logger.ts            # 日志
│   ├── stores/               # 状态管理
│   │   ├── appStore.ts          # 应用状态
│   │   └── contactStore.ts      # 联系人状态
│   ├── composables/          # 组合式函数
│   │   ├── useCapture.ts        # 快捷键
│   │   └── useWindowManager.ts  # 窗口管理
│   ├── types/                # 类型定义
│   └── assets/styles/        # 样式
├── src-tauri/                # Tauri 后端
│   ├── src/
│   │   └── lib.rs               # Rust 主逻辑
│   ├── Cargo.toml               # Rust 依赖
│   └── tauri.conf.json          # Tauri 配置
├── package.json
├── vite.config.ts
└── README.md
```

### 工作流程

```
┌─────────────────────────────────────────────────────────────┐
│                      完整工作流程                            │
└─────────────────────────────────────────────────────────────┘

用户按快捷键
    ↓
读取剪贴板内容
    ↓
识别联系人名称（正则匹配）
    ↓
检索性格档案（向量相似度搜索）
    ↓
获取风格画像（localStorage）
    ↓
加载历史对话（内存）
    ↓
组装完整 Prompt
    ↓
调用 LLM API
    ↓
返回三种回复策略
    ↓
用户选择 → 复制到剪贴板
```

---

## ⚙️ 配置说明

### 应用设置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| provider | LLM 提供商 | deepseek |
| apiKey | API 密钥 | - |
| baseUrl | API 地址 | https://api.deepseek.com |
| model | 模型名称 | deepseek-chat |
| shortcutKey | 快捷键 | Alt+Space |

### 支持的 LLM 提供商

| 提供商 | Base URL | 推荐模型 |
|--------|----------|----------|
| DeepSeek | https://api.deepseek.com | deepseek-chat |
| OpenAI | https://api.openai.com/v1 | gpt-4o-mini |
| 通义千问 | https://dashscope.aliyuncs.com/compatible-mode/v1 | qwen-max |
| 自定义 | 用户填写 | 用户填写 |

### 快捷键格式

支持以下格式：
- 单键：`F9`, `F10`, `F11`
- 组合键：`Alt+Space`, `Ctrl+Space`, `Ctrl+Shift+A`

---

## ❓ 常见问题

### 1. 快捷键不工作？

**可能原因：**
- 快捷键被其他程序占用
- 输入法冲突（`Ctrl+Space` 是中英文切换）

**解决方案：**
- 更换快捷键为 `Alt+Space` 或 `F9`
- 关闭冲突软件的快捷键

### 2. 窗口不显示？

**可能原因：**
- 窗口被最小化到托盘

**解决方案：**
- 双击系统托盘图标
- 右键托盘图标 → 显示窗口

### 3. AI 回复不相关？

**可能原因：**
- 未添加联系人
- 未提取风格画像

**解决方案：**
- 在联系人管理中添加对方信息
- 使用风格提取功能

### 4. 模型加载失败？

**可能原因：**
- 网络问题导致模型下载失败

**解决方案：**
- 检查网络连接
- 系统会自动使用后备方案（字符哈希）

---

## 👨‍💻 开发指南

### 开发命令

```bash
# 启动前端开发服务器
npm run dev

# 启动 Tauri 开发模式
npm run tauri:dev

# 构建生产版本
npm run tauri:build

# 类型检查
npm run typecheck

# 代码检查
npm run lint
```

### 添加新的 LLM 提供商

1. 编辑 `src/stores/appStore.ts`：
```typescript
const providerDefaults: Record<LLMProvider, Partial<AppSettings>> = {
  // 添加新提供商
  newprovider: {
    baseUrl: 'https://api.newprovider.com',
    model: 'model-name',
  },
};
```

2. 编辑 `src/types/index.ts`：
```typescript
export type LLMProvider = 'deepseek' | 'openai' | 'qwen' | 'custom' | 'newprovider';
```

### 添加新的功能模块

1. 在 `src/services/` 创建服务文件
2. 在 `src/components/` 创建 UI 组件
3. 在 `FloatingPanel.vue` 中集成

---

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

### 贡献步骤

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

### 代码规范

- 使用 TypeScript 编写代码
- 遵循 ESLint 规则
- 添加必要的注释
- 编写单元测试

---

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证。

---

## 🙏 致谢

- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Orama](https://oramasearch.com/) - 嵌入式搜索引擎
- [Transformers.js](https://huggingface.co/docs/transformers.js) - 浏览器端机器学习
- [Vercel AI SDK](https://sdk.vercel.ai/) - AI 应用开发工具包

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐️ Star！**

Made with ❤️ by Context-Pod Team

</div>
