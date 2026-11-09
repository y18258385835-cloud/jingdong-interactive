# 🐋 鲸动交互平台 (Jingdong / Aether Interactive Platform)

> **AI 驱动的次世代 2D / 3D 可视化交互场景、数字孪生大屏与体感互动创作引擎**

![License](https://img.shields.io/badge/License-Apache%202.0%20with%20Commons%20Clause%20(Non--Commercial)-blue)
![Node](https://img.shields.io/badge/Node.js-20%2B-green)
![React](https://img.shields.io/badge/React-19-61dafb)
![Three.js](https://img.shields.io/badge/Three.js-WebGL%20%2F%203D%20Gaussian%20Splats-black)

**鲸动交互平台（Aether Interactive）** 是一款集成了 **AI 场景生成、WebGL/Three.js 3D 渲染、Web 特效（VFX/Saber）、实时物联网（MQTT）数字孪生大屏、MediaPipe 摄像头隔空体感交互** 以及 **独立离线播放器导出** 的全栈可视化交互创作工具。

---

## ✨ 核心特性

- 🎨 **全功能可视化交互工作站**：支持多场景编排、时间轴关键帧动画、图层蒙版、组件母版（Master Components）、对齐吸附与智能交互连线编排。
- 🤖 **AI 智能创作赋能**：
  - **AI 场景生成 & Agent 协同工作区**：通过自然语言对话生成完整的数据看板或交互场景布局。
  - **AI 单图转 3D 模型 & 智能抠图**：内置图像背景移除与 3D 资产转换工作流。
  - **自定义代码智能插件（Plugin Studio）**：支持使用 AI 生成或手写自定义 HTML/Canvas/Shader 组件，并自动提取可视化调节参数。
- 🌐 **3D 与次世代视觉特效（VFX）**：
  - 支持 `GLTF/GLB` 模型、3D 高斯泼溅（Gaussian Splats）、Cannon-es 物理引擎碰撞模拟。
  - 内置流光（Saber）、形态变换（Morph VFX）、全息仪表盘（Holographic Gauges）与全国城市地图可视化组件库。
- 🖐️ **摄像头隔空手势与体感控制**：基于 MediaPipe 实现免接触手势追踪与场景交互绑定，适用于展厅大屏与新媒体互动装置。
- 📡 **实时物联网数字孪生（MQTT / BFF）**：支持 MQTT 5 实时遥测数据接入、设备状态持久化、阈值告警引擎与大屏数据实时驱动。
- 📦 **一键多格式导出与 MCP/CLI 自动化**：
  - 支持导出 **独立可离线运行的单文件/压缩包 HTML 播放器**、高清透明通道视频（WebM / MP4）及图片序列。
  - 内置 `aether-cli` 与 **MCP Server**，支持被 AI Agent 直接调用以自动化构建与导出交互工程。

---

## 🚀 快速开始

### 1. 环境要求
- **Node.js**: `>= 20.0.0`
- **包管理器**: `npm`

### 2. 安装依赖
```bash
npm install
```

### 3. 配置环境变量
复制环境变量模板并根据需要填入你的 AI API Key（如 Gemini / OpenAI 兼容接口）：
```bash
cp .env.example .env
```

### 4. 启动本地开发环境
- **仅启动前端编辑器**（默认端口 `3000`）：
  ```bash
  npm run dev
  ```
- **同时启动前端编辑器 + 本地后端服务（AI 代理 / 实时数据 BFF）**：
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\start-local.ps1
  ```

---

## 🛠️ 常用命令

| 命令 | 说明 |
| :--- | :--- |
| `npm run dev` | 启动 Vite 前端开发服务器（`http://localhost:3000`） |
| `npm run server` | 启动 Express 后端服务（AI 代理、实时遥测与授权接口） |
| `npm run build` | 构建独立导出播放器运行时、前端生产包与服务端 Bundle |
| `npm test` | 运行 Vitest 单元测试套件 |
| `npm run check` | 执行版本号校验、TypeScript 类型检查、单元测试与 i18n 完整性检查 |
| `npm run cli` | 运行 `aether-cli` 命令行工具 |
| `npm run mcp` | 启动内置 MCP Server 供 AI 客户端调用 |

---

## 📂 项目目录结构

```text
├── src/
│   ├── components/       # 编辑器核心 UI、3D 画布、时间轴、属性检查器与特效面板
│   ├── core/             # 核心引擎（AI Harness、渲染时钟、导出器、IndexedDB/OPFS 存储、MQTT 实时流、Schema 校验）
│   ├── plugins/          # 自定义代码插件中心与注册表
│   ├── i18n/             # 多语言国际化支持
│   └── utils/            # 图表、交互模型、VFX 预设、视频编码器等工具库
├── server/               # 后端服务（3D 代理、AI 契约校验、MQTT 实时遥测告警引擎、授权服务）
├── public/export-player/ # 独立 HTML 导出播放器运行时资源
├── tools/aether-cli/     # 命令行工具与 MCP 服务端实现
├── tests/                # 单元测试与 Playwright E2E 测试
└── docs/                 # 架构设计、PRD 与开发文档
```

---

## ⚖️ 开源许可与商业授权说明 (License)

本项目采用 **[Apache License 2.0 with Commons Clause (非商业开源许可协议)](./LICENSE)** 进行开源：

- ✅ **允许免费使用**：个人学习、技术研究、教学演示、非商业性质的个人创作，以及向本仓库提交代码贡献（PR）。
- ❌ **禁止未授权商业化**：未经作者书面授权，**严禁将本项目（或其修改版、打包版）直接或变相出售牟利，严禁基于本项目搭建付费 SaaS 平台、商业售卖安装包或移除版权标识用于商业项目交付**。
- 💼 **商业合作与授权**：如需用于企业内部生产部署、展厅商业项目交付或 OEM 定制，请联系作者获取商业授权。
