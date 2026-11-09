# CLI 与 MCP 控制能力

本仓库新增了一套 **离线、零依赖** 的工程文件工具与 MCP 服务器，让脚本、CI 和 AI 客户端可以直接操作鲸动工程的源数据。

## 1. 能力边界（先明确）

当前实现面向「工程源数据 (JSON)」这一份文件——也就是编辑器里 **导出 → 工程源数据 (JSON)** 免费、可离线拿到的那份。

- ✅ 可以：读取工程结构、批量改文案、改场景名/时长、校验数据、生成新工程文件
- ❌ 暂不可以：直接驱动正在运行的编辑器、触发导出渲染、截图、播放

第二阶段（见文末路线图）可以在不破坏现有架构的前提下补上「驱动运行中的编辑器」。

## 2. 命令行

```bash
# 概览
npm run cli -- inspect 我的工程.json

# 场景 / 图层
npm run cli -- scenes 我的工程.json
npm run cli -- layers 我的工程.json --scene s1

# 校验（场景、图层、越界、外链资源、自定义代码长度）
npm run cli -- validate 我的工程.json

# 改文案：默认写回原文件，--out 可另存
npm run cli -- set-text 我的工程.json --layer s1_cta_text --text "让每个像素都有生命"
npm run cli -- set-text 我的工程.json --layer s1_cta_text --text "新文案" --out patched.json

# 场景重命名 / 改时长
npm run cli -- rename-scene 我的工程.json --scene s1 --alias "01 · 空间觉醒"
npm run cli -- set-duration 我的工程.json --scene s1 --seconds 15
```

所有命令都支持 `--json`，方便被其它程序消费。

## 3. MCP 服务器

MCP（Model Context Protocol）让 Claude Desktop / Claude Code / Cursor / Codex 等客户端把本工具当成一组「工具」调用。

```jsonc
// Claude Code: ~/.claude.json 或项目 .mcp.json
// Cursor: ~/.cursor/mcp.json
{
  "mcpServers": {
    "aether": {
      "command": "node",
      "args": ["D:/AETHER交互程序新版本/-media-main - 更换Codex更换gemini/tools/aether-cli/mcp.mjs"]
    }
  }
}
```

启动方式：`npm run mcp`（stdio，按行收发 JSON-RPC 2.0）。

### 已暴露的工具

| 工具名 | 作用 | 关键参数 |
|---|---|---|
| `project_inspect` | 工程概览：场景/图层/时长/类型分布/外链资源 | `file` |
| `scene_list` | 场景列表 | `file` |
| `layer_list` | 图层列表（可按场景过滤） | `file`、`sceneId?` |
| `project_validate` | 结构校验，返回错误与警告 | `file` |
| `layer_set_text` | 改文本图层或自定义代码图层 | `file`、`layerId`、`text`、`sceneId?`、`outFile?` |
| `scene_rename` | 场景重命名 | `file`、`sceneId`、`alias` |
| `scene_set_duration` | 设置场景时长 | `file`、`sceneId`、`seconds` |

### 实时控制工具（需要软件已打开）

软件启动后会在本机运行控制桥（仅 loopback + 一次性令牌），MCP 可以直接操作**正在运行的编辑器**：

| 工具名 | 作用 | 关键参数 |
|---|---|---|
| `editor_status` | 读取当前工程、场景与图层数量 | — |
| `editor_select_scene` | 切换场景 | `sceneId` |
| `editor_set_layer_text` | 实时修改文本图层 | `sceneId`、`layerId`、`text` |
| `editor_add_text_layer` | 新建文本图层 | `sceneId`、`text`、`x/y/w/h`、`fontSize` |
| `editor_delete_element` | 删除图层 | `sceneId`、`elementId` |
| `editor_export` | 触发一次导出并下载 | `format`：`zip` / `single-html` / `json`、`saveToHost` |
| `editor_wait_for_change` | 长轮询等待工程变化（默认 25 秒） | `since`（上次 revision）、`timeoutMs` |

所有命令都会返回回执（`acknowledged` + `message`），失败时 `ok:false` 并给出原因。`editor_export` 会走正常导出门禁（免费档带水印并消耗次数）。

`editor_status` 返回的 `revision` 可用于增量订阅：把它传给 `editor_wait_for_change` 的 `since`，即可只等待下一次真实变更，不必反复轮询。

令牌文件：`data/control-token.json`（启动时生成，MCP 自动读取）。控制桥不可用时，这些工具会返回「请先打开软件」。

调用示例（stdio 一行一个 JSON）：

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"project_inspect","arguments":{"file":"D:/projects/demo.json"}}}
```

### 安全模型

- 不监听端口、不联网、不需要授权码；只处理你显式传入路径的文件
- 修改类工具默认写回原文件，建议先用 `--out` / `outFile` 另存再比对
- 不会执行工程里的自定义代码（只做结构读写）

## 4. 为什么先做文件层

编辑器的 `export.ts`、`htmlExporter.ts`、`videoExporter.ts` 全部依赖浏览器（DOM、Canvas、MediaRecorder、WebGL）。要在 Node 里直接导出，需要引入无头浏览器与一整套渲染管线，属于独立工程。先做文件层可以立刻覆盖最高频的自动化需求（批量改文案、生成多语言版本、CI 校验、AI 批量改稿），且零风险。

## 5. 路线图：让 CLI/MCP 控制运行中的编辑器

建议分三步，均不需要重写现有架构：

1. **本地控制桥（推荐首发）**
   在 `server/index.js` 增加仅本机可用的 `/api/control`（WebSocket 或 SSE），编辑器启动时主动连接并注册为 `editor` 角色。
   能力：`loadProject`、`setLayerText`、`selectLayer`、`screenshot`、`startExport`、`getState`。
   MCP 的 `tools/call` 转发到该桥，即可实现"AI 直接改当前打开的工程"。
2. **无头导出**
   用 Playwright + 现有 `public/export-player` 运行时，把「加载工程 → 截图/录屏 → 输出 HTML/ZIP」跑在 CI 里，产出预览图与回归基线。
3. **模板批量生产**
   基于 1+2，MCP 工具扩展为 `template_batch_render`：一次输入 CSV/JSON 数据 + 模板工程，输出一批成品。

第 1 步涉及一个关键设计：控制桥必须默认关闭、仅 loopback、带一次性口令，否则会变成新的本地攻击面（与本次修复前的 `/api/open-folder` 同类问题）。
