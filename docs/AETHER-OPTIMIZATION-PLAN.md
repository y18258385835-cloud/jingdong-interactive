# AETHER Studio 优化与 AI 化改造实施方案

- 版本：v1.0
- 日期：2026-08-29
- 适用范围：`D:\AETHER交互程序新版本\-media-main`
- 执行者：后续 AI / 开发者（按本文档逐步实施）
- 配套现状：本项目当前为「桌面级多媒体动效时间轴与场景交互创作工作台（Aether Studio Desktop）」，React 19 + TypeScript + Vite + Three.js 纯前端应用，无后端。

---

## 0. 如何阅读与使用本文档

本文档是**可执行规格说明书（Executable Spec）**，不是概念文章。目标：让任何后续 AI 或开发者**不提问、不猜测**地按本文档逐步实施，且每一步都有明确的"完成定义（DoD，Definition of Done）"和验证方法，从根上避免返工与 BUG。

### 0.1 使用规则

1. 每个阶段必须**严格按顺序**执行，前一阶段 DoD 未通过不得进入下一阶段。
2. 文档中所有**接口签名、数据结构、错误码、命令、文件名**均为强制约束，不得自行改名、改型。
3. 若发现本文档与现有代码存在冲突，**立即停止该步骤**，在变更记录中写入冲突详情，并回退到稳定状态，不得"绕过去"。
4. 每个阶段完成后必须运行该阶段的"验证"小节列出的全部命令并全部通过。
5. 本文档允许的修改范围以各阶段"改动范围"为准；**未列出的文件一律不允许改动**（尤其是现有 `src/components` 与 `src/utils` 中未要求触碰的逻辑，改动前必须新增可回归的测试）。

### 0.2 已核实的项目现状（基线事实，勿臆测）

| 项 | 现状 |
|---|---|
| 技术栈 | React 19、TypeScript ~5.8、Vite 6、TailwindCSS 4、Three.js 0.185、@mkkellogg/gaussian-splats-3d、JSZip、lucide-react、motion |
| 入口 | `index.html` → `src/main.tsx` → `src/App.tsx`（约 70KB） |
| 工程持久化 | `localStorage`，key=`aether_desktop_project_v42`，400ms debounce 自动保存 |
| 素材持久化 | IndexedDB，DB 名=`AetherDesktopDB_v42`，objectStore：`assets`、`projects`；`src/utils/db.ts` 的 `AssetDatabase` |
| 元素类型 | 11 种：`img / vid / txt / shape / saber / 3d_group / chart / panorama-img / panorama-vid / model-3d / gaussian-splat` |
| 动画类型 | 入场 16 种、出场 14 种、循环 11 种（见 `src/types/index.ts`） |
| 转场类型 | 13 种（`SceneTransitionType`） |
| 导出能力 | `src/utils/export.ts`：单文件 HTML（dataURL 内联）、ZIP 工程包（index.html + project.json + assets/） |
| 导出运行时 | 手写 vanilla JS（`generateStandaloneHTML`），**仅实现 img/vid/txt/chart/shape 5 种元素**，keyframe 仅 10 个 |
| 历史记录 | 全量快照栈（上限 60 条），`HistoryItem.snapshot` 存整工程 JSON |
| 后端 | 无实际后端；`express`、`@google/genai`、`dotenv` 已在 dependencies 但**未被使用** |
| 声明能力 | `metadata.json` 声明 `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`，但源码中无任何 Gemini 调用 |
| 脚本 | `dev`(vite :3000) / `build` / `preview` / `clean` / `lint`(tsc --noEmit) |

### 0.3 目标架构（唯一事实来源原则）

```
                    ┌─────────────────────────────┐
                    │   ProjectData Schema (JSON)  │ ← 唯一事实来源，稳定版本化
                    └──────────────┬──────────────┘
                                   │ 读写（全部经 zod 校验）
        ┌──────────────┬───────────┼────────────┬───────────────┬─────────────┐
        ▼              ▼           ▼            ▼               ▼             ▼
   编辑器 UI      导出播放器     Node API     CLI 工具      MCP Server     AI 生成
   (React)        (HTML)      (Express)     (aether)      (SDK)        (Gemini)
        └──────────────┴───────────┴────────────┴───────────────┴─────────────┘
                         全部复用同一个 headless 核心：src/core/
```

**核心原则**：`src/core/` 是纯 Node 可运行、零 React/DOM 依赖的业务内核。编辑器、导出、API、CLI、MCP、AI 生成六者**只能**通过 `src/core` 操作数据，禁止任何一方绕过核心直接读写工程数据或 React 状态。

### 0.4 铁律（全程禁止违反，违反即判 BUG）

1. **禁止删除/重命名现有 `SceneElement`/`Scene`/`ProjectData` 的任何字段**。只允许新增；删除字段必须走 §1.5 迁移流程。
2. **禁止只改"编辑器"或只改"导出运行时"其中一套逻辑**。渲染/导出行为必须收敛到 `src/core/exporter/render.ts` 唯一来源（§6.1）。
3. **禁止在无 zod 校验的情况下接受外部写入的 ProjectData**（API / CLI / MCP / AI 生成 / 文件导入一律先校验）。
4. **禁止 `catch {}` 静默吞错**。所有异步 IO 失败必须记录日志并向上抛 `AetherError`。
5. **所有写接口必须幂等**：同一请求重复执行结果一致（详见 §2.4）。
6. **禁止在 `src/core/` 引入 React / DOM / 浏览器 API / localStorage / indexedDB**。核心必须可在 Node 与浏览器双端运行（通过注入式存储接口适配）。
7. **禁止硬编码密钥**。一律读环境变量（`GEMINI_API_KEY`、`AETHER_API_KEYS` 等），并支持 `.env`（已装 `dotenv`）。
8. **每次改动后必须跑 `npm run lint`（0 error）+ 相关单测全绿**才能算完成。
9. **禁止整文件复制改写巨型组件**。必须按 §4 拆分方案进行，且拆分前先补回归测试锁定行为。
10. **数据格式改动必须同步 bump `SCHEMA_VERSION` 并新增迁移函数**，禁止直接改 key 名。
11. **导出时不允许静默丢弃不支持的元素/动画**，必须 `preflightExport` 强校验 + 明示警告（§6.4）。
12. **AI 生成结果未经 zod 校验与归一化，禁止写入工程**（§10.4）。

### 0.5 环境与命令

- 环境：Node ≥ 20，npm ≥ 10（Windows PowerShell 下运行）。
- 常用命令：
  - `npm run dev` — 启动编辑器（http://localhost:3000）
  - `npm run lint` — 类型检查（tsc --noEmit），必须 0 error
  - `npm test` — 单元测试（阶段 1 起生效）
  - `npm run build` — 生产构建
  - `npm run server` — 启动 API 服务（阶段 5 起生效）
  - `npm run cli -- <args>` — 运行 CLI（阶段 6 起生效）
- 全部命令在项目根目录执行；新增脚本统一维护到 `package.json`。

---

## 1. 阶段零：Schema 稳定化与校验（P0，先于一切）

**目标**：让 ProjectData 成为稳定、可校验、可迁移的"契约"，杜绝 AI/API/CLI 写入后工程崩溃。

### 1.1 新增依赖

- 安装 `zod`（唯一 Schema 定义库）。
  ```bash
  npm install zod
  ```

### 1.2 新增文件与版本常量

- 新增 `src/core/schema/version.ts`：
  ```ts
  export const SCHEMA_VERSION = 43;          // 当前工程数据模型版本
  export const CURRENT_STORAGE_KEY = 'aether_desktop_project_v43'; // 本轮起 bump
  export const DB_NAME = 'AetherDesktopDB_v43';
  ```
- 新增 `src/core/schema/types.ts`：把现有 `src/types/index.ts` 的类型**重新导出并扩展**（不删除原文件，原文件继续作为 UI 层类型来源，核心层从 `core/schema/types` 引入）。

### 1.3 ProjectData 顶层结构（最终目标，新增字段用 `[NEW]` 标注）

```ts
export interface ProjectData {
  schemaVersion: number;             // [NEW] 必填，等于 SCHEMA_VERSION
  meta: ProjectMeta;                 // { v, title?, author?, updatedAt? }
  scenes: Record<string, Scene>;
  start: string;
  is3DParallaxEnabled?: boolean;
  parallaxIntensity?: number;
  variables?: GlobalVariable[];
  components?: ComponentPreset[];
  assets?: AssetManifest;            // [NEW] 素材清单，见 1.4
  branding?: BrandingConfig;         // [NEW] 品牌/水印/授权，见 1.6
  settings?: EditorSettings;         // [NEW] UI 持久化偏好（编辑态/折叠/缩放等）
}

export interface AssetManifest {     // [NEW]
  version: number;                   // 固定 1
  items: Record<string, AssetEntry>;
}
export interface AssetEntry {        // [NEW]
  refId: string;                     // 与 SceneElement.refId 一一对应
  kind: 'image' | 'video' | 'audio' | 'model' | 'splat';
  mime: string;                      // 如 image/png
  size: number;                      // 字节
  sha256?: string;                   // [NEW] 可选，用于去重/校验
  createdAt: string;                 // ISO 时间
}

export interface BrandingConfig {    // [NEW]
  license: 'free' | 'pro' | 'enterprise';  // 默认 'free'
  watermark?: { enabled: boolean; text: string }; // 导出水印配置
  brand?: { name?: string; primaryColor?: string }; // 模板/品牌色
}

export interface EditorSettings {    // [NEW]
  lastActiveSceneId?: string;
  viewport?: ViewportState;          // 复用现有类型
  timelineCollapsed?: boolean;
  recentProjects?: { id: string; title: string; updatedAt: string }[];
}
```

### 1.4 字段约束表（zod 必须逐一落实）

| 字段 | 类型 | 约束 |
|---|---|---|
| `SceneElement.x/y/w/h` | number | 0–100（百分比），`w/h` > 0 |
| `SceneElement.zIndex` | number | 整数，1–10000 |
| `SceneElement.opacity` | number | 0–100 |
| `SceneElement.rot` | number | 任意，默认 0 |
| `SceneElement.startTime/duration` | number | ≥ 0，duration 可 0（瞬态） |
| `SceneElement.animDur/exitAnimDur` | number | 0–60 秒 |
| `SceneElement.loopAnimSpeed` | number | 0.1–5 |
| `SceneElement.depthZ` | number | -100–100 |
| `SceneElement.parallaxFactor` | number | 0–1 |
| `SceneElement.hoverDelay` | number | 0–10 秒 |
| `SceneElement.fontSize` | number | 1–1000 |
| `Scene.duration` | number | > 0 |
| `Scene.transitionDuration` | number | 0–10 秒 |
| `SceneElement.type` | enum | 11 种元素之一（见 0.2） |
| `SceneElement.animType/exitAnimType/loopAnim` | enum | 对应枚举之一，或 `'none'` |
| `SceneElement.blendMode` | enum | `normal/screen/multiply/overlay/lighten/color-dodge` |
| `SceneElement.linkType` | enum | `jump/popup/url` |
| `SceneElement.trigger` | enum | `click/hover` |
| `ProjectData.scenes` | object | 非空；`start` 必须指向存在的 scene id |
| `SceneElement.id` / `Scene.id` | string | 唯一，非空，≤ 128 字符，禁止含 `/` `\` |

> 说明：以上是**新增校验**，不是改现有行为。校验失败只拦截"外部/异常写入"，对当前编辑器内部正常流程必须**零影响**（现有工程数据若因历史原因存在边界值，由 `normalizeProjectData` 做"温和修复 + 日志"，不直接抛错，见 1.5）。

### 1.5 读取归一化与迁移（唯一入口）

新增 `src/core/schema/normalize.ts`：

```ts
export type NormalizeResult =
  | { ok: true; data: ProjectData; warnings: string[] }
  | { ok: false; error: AetherError };

export function normalizeProjectData(raw: unknown): NormalizeResult
```

处理顺序（严格按此）：
1. `raw` 为 null/undefined → 返回 `E_VALIDATION`，message=`工程数据为空`。
2. 非对象 → `E_VALIDATION`。
3. 读 `schemaVersion`：缺失 → 按旧版数据尝试 `LEGACY_ADAPTERS`（当前只接受无 `schemaVersion` 的 v42 数据，按缺省 42 处理，并记 warning）。
4. 若 `schemaVersion < SCHEMA_VERSION`：依次执行 `MIGRATIONS[schemaVersion]`、`MIGRATIONS[schemaVersion+1]`…直到 `SCHEMA_VERSION`；任一迁移抛错 → `E_SCHEMA_MIGRATION`。
5. 若 `schemaVersion > SCHEMA_VERSION`：返回 `E_SCHEMA_NEWER`（数据来自更新版本，拒绝写入）。
6. 迁移后做 `validateProjectData`（zod.safeParse）。
   - 失败且错误属"可温和修复"类（如坐标越界、start 指向不存在场景）→ 修复 + 记 `warnings`；其余 → `E_VALIDATION` 并携带 `ValidationIssue[]`。
7. 成功返回归一化后的 data。

迁移注册表 `src/core/schema/migrations.ts`：

```ts
export type Migration = (prev: any) => any;
export const MIGRATIONS: Record<number, Migration> = {
  // 42→43：新增 schemaVersion/assets/branding/settings；把 localStorage key 从 v42 迁移到 v43
  42: (prev) => ({ schemaVersion: 43, assets: { version: 1, items: {} }, ...prev }),
};
```

迁移要求：**幂等**（重复执行结果一致）；不得修改 `scenes` 内容（除非有明确理由并写入变更记录）。

### 1.6 校验器

新增 `src/core/schema/validate.ts`：

```ts
export interface ValidationIssue { path: string; message: string }
export function validateProjectData(data: unknown):
  | { ok: true }
  | { ok: false; issues: ValidationIssue[] }
```

- 用 zod 完整定义 1.3/1.4 的结构与约束，导出 `ProjectDataSchema`。
- `issues[].path` 格式：`scenes.home.els[3].w`（点路径 + 数组下标），供 AI/CLI 精准定位。
- **核心之外的所有入口**（编辑器加载、文件导入、API 写入、CLI 写入、MCP、AI 生成）必须调用 `normalizeProjectData`，禁止各自造校验逻辑。

### 1.7 编辑器接入点改造（最小改动）

- `src/App.tsx` 初始 state：
  ```ts
  const saved = localStorage.getItem(CURRENT_STORAGE_KEY);   // 先读 v43
  const legacy = !saved ? localStorage.getItem('aether_desktop_project_v42') : null;
  const raw = saved ?? legacy;
  const result = normalizeProjectData(raw ? JSON.parse(raw) : undefined);
  // ok → 使用 data（并立即回写 v43、清理 v42 key）；!ok → 使用 DEFAULT_PROJECT_DATA + 弹错误 toast
  ```
- `src/utils/db.ts`：`indexedDB.open(DB_NAME, 2)` 使用新 DB 名；首次打开时把旧库 `AetherDesktopDB_v42` 的 assets 复制过来（一次性迁移，成功后删除旧库，失败保留旧库并记日志）。
- **DoD**：
  - `npm run lint` 0 error。
  - 启动 `npm run dev`，F12 控制台无 `catch {}` 类静默错误；现有示例工程正常打开。
  - 手工验证：localStorage 出现 `aether_desktop_project_v43`，v42 key 被清理；IndexedDB 出现 `AetherDesktopDB_v43`。
  - 新增单测 `tests/schema/normalize.test.ts`：覆盖——空数据、缺 schemaVersion、42→43 迁移、越界字段温和修复、start 指向缺失场景、schemaVersion 超前拒绝、非法枚举拒绝。

---

## 2. 错误处理与健壮性规范（贯穿全部阶段）

### 2.1 统一错误类型

新增 `src/core/errors.ts`：

```ts
export type ErrorCode =
  | 'E_VALIDATION'        // 数据校验失败
  | 'E_SCHEMA_MIGRATION'  // 迁移失败
  | 'E_SCHEMA_NEWER'      // 数据版本高于程序
  | 'E_NOT_FOUND'         // 场景/图层/工程/素材不存在
  | 'E_CONFLICT'          // id 冲突/重复创建
  | 'E_STORAGE_FULL'      // localStorage/IndexedDB 配额满
  | 'E_EXPORT_TOO_LARGE'  // 单文件导出超限
  | 'E_EXPORT_UNSUPPORTED'// 含不支持导出的元素
  | 'E_AUTH_REQUIRED'     // 未授权/无 API Key
  | 'E_AI_TIMEOUT'        // AI 调用超时
  | 'E_AI_GENERATION_FAILED' // AI 生成或校验失败
  | 'E_INTERNAL';         // 未归类内部错误

export class AetherError extends Error {
  constructor(public code: ErrorCode, message: string, public details?: unknown) {
    super(message);
    this.name = 'AetherError';
  }
}
```

### 2.2 错误在各层的映射（强制一致）

| 层 | 表示方式 |
|---|---|
| headless 核心 | 抛 `AetherError` |
| API | HTTP 状态 + body `{ "code": "...", "message": "...", "details": ... }`；映射表见 §7.3 |
| CLI | 退出码 + stderr 输出 `[E_CODE] message` |
| MCP | `isError: true` + `content[].text` 为 `[E_CODE] message` |
| 编辑器 UI | toast 展示 message；控制台输出完整 `AetherError` |

### 2.3 边界条件处理清单（必须实现并有测试）

| # | 场景 | 处理策略 |
|---|---|---|
| B1 | 空工程（无 scenes） | 禁止创建：`E_VALIDATION` |
| B2 | 空场景（无元素） | 允许；导出时跳过，不入 warning |
| B3 | `start` 指向不存在场景 | normalize 时自动修正为第一个场景 id + warning |
| B4 | 重复元素 id / 场景 id | 创建时由 `genId()` 生成唯一 id（`uid_<ts>_<rand>`），收到外部重复 id → `E_CONFLICT` |
| B5 | 坐标/尺寸越界 | normalize 温和修复 + warning（见 1.5） |
| B6 | duration ≤ 0 | 归一化为 0；导出 runtime 视为瞬态 |
| B7 | 超大素材（单文件 > 20MB） | 导入时警告；导出 ZIP 允许，单文件 HTML 拒绝并提示改用 ZIP |
| B8 | 并发写入同一工程 | 写入侧加 `updatedAt` 乐观锁：提交时若服务端 `updatedAt` 更新 → `E_CONFLICT` |
| B9 | 文件名含中文/空格/特殊字符 | 导入与导出统一 `encodeURIComponent` 处理 refId；ZIP 内文件名 sanitize |
| B10 | 元素引用的素材在导出时缺失 | `preflightExport` 报 warning，导出时该元素渲染为占位底 + 提示，禁止静默消失 |
| B11 | 不受支持导出的元素类型（saber/3d/panorama/model/splat） | 按 §6.2 策略处理，必须有明示 |
| B12 | localStorage 配额满 | 捕获 `QuotaExceededError` → 回退提示"素材过多，请使用云/工程包导出"，不丢已保存内容 |
| B13 | 删除被其他场景引用的素材 | 删除前检查引用，存在引用 → 返回 `E_CONFLICT` 并列出引用位置 |
| B14 | AI 返回非法 JSON | 走 §10.4 重试/兜底，不写入半成品 |

### 2.4 幂等性规范

- 所有"新建"操作（工程/场景/元素/素材）的 id 由服务端/核心生成，重复提交同一数据 → 返回同一结果（存在则返回已存在项，不报错）。
- API 层所有写端点支持可选请求头 `Idempotency-Key`，服务端缓存该 key 的结果（TTL 24h）。
- CLI/MCP 的"更新"操作以 `id` 定位，重复执行对同 id 幂等。

---

## 3. 阶段一：Headless 核心抽离（P0）

**目标**：把纯业务逻辑从 React 组件抽到 `src/core/`，Node 可运行，供 API/CLI/MCP/AI 复用。**本阶段不改任何 UI 行为**。

### 3.1 目录结构（新增，全部新建）

```
src/core/
  index.ts                 # 统一出口（re-export 全部公共 API）
  errors.ts                # §2.1
  schema/                  # §1 全部
  engine/
    scene.ts               # 场景 CRUD / 排序 / 转场配置
    element.ts             # 图层 CRUD / zIndex 归一化 / 批量变换
    group.ts               # 图层分组 CRUD
    template.ts            # 模板加载与合并
    transforms.ts          # 变换计算（坐标/旋转/层级，纯函数）
  animation/
    keyframes.ts           # 动画 keyframe 唯一来源（16 入场 + 14 出场 + 11 循环）
    transitions.ts         # 13 种转场唯一来源
  variables/
    resolve.ts             # 全局变量绑定解析唯一来源
  exporter/
    render.ts              # 共享渲染核心：元素 → RenderDescriptor（阶段 4 实现）
    html.ts                # standalone HTML 组装
    zip.ts                 # ZIP 工程包
    singleFile.ts          # 单文件 HTML
    preflight.ts           # 导出前校验（阶段 4）
  project/
    crud.ts                # 工程创建/读取/保存/校验/归一化（依赖注入存储）
  storage/
    types.ts               # StorageProvider 接口（浏览器/Node 双端）
    browser.ts             # IndexedDB + localStorage 实现
    node.ts                # Node 文件系统实现（供 API/CLI）
  id.ts                    # genId() 唯一 id 生成
  logger.ts                # 统一日志（console + 可注入）
```

### 3.2 关键函数签名（强制契约）

`src/core/engine/scene.ts`：
```ts
export interface SceneOps {
  createScene(project: ProjectData, opts: { alias?: string; duration?: number }): { project: ProjectData; scene: Scene };
  duplicateScene(project: ProjectData, sceneId: string): { project: ProjectData; scene: Scene };
  deleteScene(project: ProjectData, sceneId: string): { project: ProjectData; deletedStart?: string };
  reorderScenes(project: ProjectData, orderedIds: string[]): ProjectData;
  updateScene(project: ProjectData, sceneId: string, patch: Partial<Scene>): ProjectData;
  setSceneTransition(project: ProjectData, sceneId: string, transition: Partial<Scene>): ProjectData;
}
```
> 注意：`reorderScenes` 必须同步更新每个 scene 的 `order` 字段（0-based，按 `orderedIds` 顺序），保证导出与播放一致。

`src/core/engine/element.ts`：
```ts
export interface ElementOps {
  addElement(project: ProjectData, sceneId: string, el: Omit<SceneElement, 'id' | 'zIndex'>): { project: ProjectData; element: SceneElement };
  updateElement(project: ProjectData, sceneId: string, elId: string, patch: Partial<SceneElement>): ProjectData;
  deleteElement(project: ProjectData, sceneId: string, elId: string): ProjectData;
  duplicateElement(project: ProjectData, sceneId: string, elId: string): { project: ProjectData; element: SceneElement };
  reorderElement(project: ProjectData, sceneId: string, elId: string, newIndex: number): ProjectData;
  normalizeZIndices(scene: Scene): Scene;   // 迁移现有 App.tsx 中 normalizeSceneZIndices 逻辑
  alignElements(elements: SceneElement[], axis: 'left'|'center'|'right'|'top'|'middle'|'bottom'|'distribute-h'|'distribute-v'): SceneElement[];
}
```
- `addElement` 自动分配 `zIndex = (maxZ + 10)`，并设置 `startTime/duration` 默认值（`0 / 场景剩余时长`）。
- `duplicateElement` 复制全部字段，仅替换 `id`，新 id 唯一。

`src/core/variables/resolve.ts`：
```ts
export interface ResolveContext { variables?: GlobalVariable[]; time: number; }
export function resolveElementBinding(el: SceneElement, ctx: ResolveContext): SceneElement;
// 把现有 export.ts 中 "全局变量绑定解析" 逻辑唯一化，编辑器与导出共用。
```

`src/core/project/crud.ts`：
```ts
export interface ProjectStore {   // 由调用方注入，保证核心双端可跑
  load(id: string): Promise<unknown | null>;
  save(id: string, data: ProjectData): Promise<void>;
  list(): Promise<{ id: string; title?: string; updatedAt?: string }[]>;
  delete(id: string): Promise<void>;
}
export async function loadProject(store: ProjectStore, id: string): Promise<ProjectData>;
export async function saveProject(store: ProjectStore, data: ProjectData): Promise<ProjectData>; // 写前 normalize + 补 schemaVersion/updatedAt
```

`src/core/id.ts`：
```ts
export function genId(prefix = 'uid'): string; // `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`
```

### 3.3 从现有代码迁移映射表（防遗漏）

| 现有位置 | 迁移到 | 说明 |
|---|---|---|
| `App.tsx` `normalizeSceneZIndices` | `core/engine/element.ts` `normalizeZIndices` | 行为逐字节一致 |
| `App.tsx` 场景/图层增删改查 | `core/engine/*` | 抽成纯函数，App 调用后 `setProjectData` |
| `utils/export.ts` 绑定解析段 | `core/variables/resolve.ts` | 唯一化 |
| `utils/export.ts` `buildChartSVG` 相关 | `core/exporter/render.ts` | 阶段 4 收敛 |
| `utils/chartCore.ts` | `core/exporter/` 或保留 utils 再 re-export | 阶段 4 处理 |
| `utils/saberPresets.ts` / `shapeStyles.ts` | 保留 utils，`core` 引用 | 纯数据模块，先不动 |
| `utils/defaultData.ts` | 保留；App 初始化改走 `normalizeProjectData` | 保证示例工程通过校验 |

### 3.4 迁移策略与验证

- **策略**：核心层新建并单测通过后，UI 层**逐步**改为调用核心（一次改一个操作，每个操作改完立刻回归），不要一次性大规模替换。
- **DoD**：
  - `npm run lint` 0 error。
  - `npm test` 全绿；新增测试覆盖：`engine/*` 全部操作、`variables/resolve`（含无变量、绑定缺失、非法数值）、`project/crud`（用内存 mock store）。
  - 编辑器回归（手动，逐项打勾）：新建/复制/删除/排序场景；增删改复制/排序/对齐图层；zIndex 归一化结果与旧版一致；全局变量绑定生效。
  - `src/core/` 中 `grep -rE "React|document\.|window\.|localStorage|indexedDB"` 为空（storage 适配器除外）。

---

## 4. 阶段二：状态管理与组件拆分（P1）

**目标**：解决巨型组件与散落状态问题，让后续 AI/API 能稳定增量开发。**本阶段不改变任何对外行为与快捷键**。

### 4.1 引入 Zustand

```bash
npm install zustand
```

新增 `src/stores/`：
```ts
// useProjectStore：projectData + 全部工程写操作（内部调用 src/core/engine）
// useSelectionStore：selectedElementId / multiSelectedIds / 选择操作
// usePlaybackStore：currentTime / isPlaying / isCruising / autoAdvance / volume / isMuted / loop
// useHistoryStore：historyList / historyIndex / undo / redo / push / jump
// useUIStore：viewport / isEditing / 各弹窗开关 / isTimelineCollapsed / activeTab
```

迁移规则：
- 每个 store 先新建并暴露与 App 当前 state 同名的 selector，**App 逐步**把 `useState` 换为 `useProjectStore` 等，一次一个维度，每换一个跑一次回归。
- **禁止**一次把所有 state 全部迁完再验证。

### 4.2 巨型组件拆分方案（文件级目标）

| 现文件 | 拆分目标（新建目录 `src/components/` 下子目录） |
|---|---|
| `App.tsx` (~70KB) | `App.tsx`（仅容器/编排）+ `src/hooks/useProject.ts`、`useHistory.ts`、`useHotkeys.ts`、`useAutoSave.ts` + `src/components/modals/*` 弹窗 |
| `LeftSidebar.tsx` (~98KB) | `sidebar/SceneList.tsx`、`sidebar/LayerList.tsx`、`sidebar/TemplateList.tsx`、`sidebar/HistoryList.tsx` + 各列表内子组件 |
| `CanvasViewport.tsx` (~96KB) | `viewport/CanvasStage.tsx`（渲染）、`viewport/SelectionBox.tsx`、`viewport/ToolLayer.tsx`（saber-draw/pan）、`viewport/Guides.tsx`（安全框/网格/参考线） |
| `InspectorPanel.tsx` (~88KB) | `inspectors/index.tsx`（路由）+ `inspectors/TextInspector.tsx`、`ImageInspector.tsx`、`ShapeInspector.tsx`、`ChartInspector.tsx`、`SaberInspector.tsx`（复用现有）、`TimingInspector.tsx`、`InteractionInspector.tsx`、`EffectInspector.tsx` |
| `TimelineWorkstation.tsx` (~53KB) | `timeline/TrackList.tsx`、`timeline/TrackItem.tsx`、`timeline/Ruler.tsx`、`timeline/Playhead.tsx`、`timeline/TransportBar.tsx` |

拆分约束：
- 每个新文件**职责单一、可独立测试**；组件内不再出现 `projectData.scenes[..].els[..]` 深链，一律通过 store selector 派生。
- 行为迁移用"先复制原逻辑到新文件 + 用原文件引用新文件"的渐进方式，**不要重写逻辑**。
- 拆分过程中**不得修改任何 DOM 结构/class 名/快捷键**。

### 4.3 DoD

- `npm run lint` 0 error；`npm test` 全绿（新增：`useHistoryStore` 的 undo/redo/jump 单测）。
- 手动回归清单（与 §3.4 相同，另加）：撤销重做历史计数、快捷键全部有效、编辑/演示模式切换、多选对齐分布、时间轴播放。
- 拆分后任一组件文件 ≤ 30KB（作为硬指标）。

---

## 5. 阶段三：存储与历史健壮化（P1）

**目标**：数据不丢、不爆容量、可恢复；历史记录不再全量快照。

### 5.1 存储改造（依赖 §3 `storage/`）

- 浏览器端 `storage/browser.ts`：
  - 工程元数据（ProjectData）→ IndexedDB `projects` store（**不再存 localStorage**；localStorage 仅作 v43 迁移期兼容，迁移完成即弃用）。
  - 素材 Blob → IndexedDB `assets` store（沿用 `AssetDatabase` 逻辑，DB 名用 `AetherDesktopDB_v43`）。
  - 实现 `ProjectStore` 与 `AssetStore` 接口，注入 `core/project/crud.ts`。
- 写入前检查配额：`navigator.storage.estimate()`，预估超出 90% 返回 `E_STORAGE_FULL` 提示，不静默失败。

### 5.2 自动保存与版本快照

- `src/hooks/useAutoSave.ts`：
  - 防抖 2s 自动保存工程（替代现有 400ms 直接写 localStorage）。
  - 每 5 分钟或每次"重大操作"（新场景/批量删除/导入/模板套用）额外存一份**版本快照**（IndexedDB `project_versions` store，保留最近 10 份，超出滚动删除最旧）。
  - 版本快照结构：`{ id, projectId, createdAt, reason, data }`。
- 崩溃恢复：启动时检测 `project_versions` 中是否存在"未确认恢复"的最近快照 → 弹提示"检测到未保存的变更，是否恢复？"；确认后以快照覆盖当前工程，并写变更记录。

### 5.3 历史记录改造（性能）

- 从"全量快照栈"改为**反向补丁栈**：
  ```ts
  interface HistoryPatch { type: 'replace'; path: string; prev: unknown; next: unknown } // 或增量 diff
  interface HistoryEntry { id: string; title: string; actionType: HistoryActionType; sceneId?: string; timestamp: number; patches: HistoryPatch[] }
  ```
- 实现 `core/history/patchStore.ts`（纯函数，可单测）：
  - `buildPatch(prev, next)` → patches[]（对 scenes 按 sceneId 做 diff，元素级数组 diff 用最小操作）
  - `applyPatch(data, patches, dir: 'forward'|'backward')` → data
- 保留现有行为：上限 60 条、800ms 连续编辑合并、redo 分支截断、`HistoryPanel` 时间跳转。
- `useHistoryStore` 内部改用补丁栈；对外暴露的 `HistoryItem` 接口**保持不变**（`HistoryPanel.tsx` 零改动）。

### 5.4 DoD

- `npm run lint` 0 error；`npm test` 全绿（新增：`patchStore` 构建/应用/回退一致性、自动保存 debounce、版本快照滚动删除）。
- 手工验证：编辑后刷新页面数据仍在（来自 IndexedDB）；删除素材到配额模拟→出现 `E_STORAGE_FULL` 友好提示；撤销 60 步无卡顿（用含 100+ 元素的工程验证，操作响应 < 100ms）。

---

## 6. 阶段四：导出一致性修复（P0，产品信誉生死线）

**目标**：导出播放器与编辑器所见一致；不支持项必须明示，禁止静默丢失。

### 6.1 共享渲染内核（唯一来源）

- 新增 `src/core/exporter/render.ts`，定义中间结构并**同时**驱动编辑器画布与导出播放器：
  ```ts
  export interface RenderDescriptor {
    kind: 'img'|'vid'|'txt'|'shape'|'chart'|'saber'|'3d'|'panorama'|'model'|'splat'|'placeholder';
    style: Record<string, string>;   // 最终 CSS 样式
    content?: string;                // 文本
    src?: string;                    // 资源引用
    chart?: { svg?: string; dynamic?: { kind: 'counter'|'clock' } };
    saber?: SaberRenderSpec;
    three?: { type: string; params: Record<string, unknown> };
    fallbackText?: string;           // 降级说明
  }
  export function elementToDescriptor(el: SceneElement, ctx: ResolveContext): RenderDescriptor;
  export function descriptorToDOM(desc: RenderDescriptor): HTMLElement | null;  // 编辑器用
  export function descriptorToHTML(desc: RenderDescriptor): string;            // 导出用
  ```
- **编辑器 CanvasViewport 的 `renderElement` 迁移为调用 `elementToDescriptor + descriptorToDOM`；导出 `generateStandaloneHTML` 的 `loadScene` 迁移为调用同一 `elementToDescriptor + descriptorToHTML`。** 两者从此只有"目标环境"差异，无逻辑差异。

### 6.2 元素类型导出覆盖清单（逐项策略）

| 类型 | 编辑器 | 导出策略（按顺序实现） | 未实现前行为 |
|---|---|---|---|
| img / vid / txt / shape / chart | ✅ | 现有支持，迁到共享内核 | — |
| saber | ✅ | 在导出 runtime 补渲染：SVG path（`saberPath`）+ core/glow 图层 + 生长模式动画（复用 `core/animation`） | `preflight` 报 `E_EXPORT_UNSUPPORTED` warning，导出为占位 + 文案说明，**用户确认** |
| 3d_group | ✅ | 导出为静态合成（按视差因子渲染一个基准帧），或引入 Three.js 运行时 | 同上 |
| panorama-img / panorama-vid | ✅ | 导出 runtime 引入 Three.js 球体贴图 + 拖拽/自动旋转（复用 `ThreeCanvas` 逻辑的最小版本） | 同上 |
| model-3d | ✅ | 导出 runtime 加载 glTF（assets 内含模型文件） | 同上 |
| gaussian-splat | ✅ | 导出 runtime 引入 `@mkkellogg/gaussian-splats-3d` | 同上 |

> 实现优先级：先保证 **saber + panorama-img/vid**（展厅大屏最高频），再 model-3d，最后 gaussian-splat。每实现一类，对应 6.5 测试必须补齐。

### 6.3 动画 keyframe 补全清单（导出 CSS 必须全量定义）

在 `core/animation/keyframes.ts` 定义唯一来源，并生成导出 CSS：

入场 16 种：`none, fade-in, slide-up, slide-down, slide-left, slide-right, zoom-in, zoom-out, elastic-pop, flip-3d, glitch, rotate-in, bounce-in, blur-in, tilt-in, fade-blur-in`
出场 14 种：`none, fade-out, slide-down, slide-up, slide-left, slide-right, zoom-out, zoom-in, fade-zoom, rotate-out, blur-out, bounce-out, flip-out, dissolve-out`
循环 11 种：`none, pulse, float, spin, shimmer, breathe, swing, shake, heartbeat, blink, wave`

- 导出 CSS 当前只定义 10 个 keyframe（fade-in/out、slide-up/down/right/left、zoom-in/out、elastic-pop、pulse、float）→ **必须补齐其余全部**，且与编辑器 CSS 逐字一致（从同一 `keyframes.ts` 生成）。
- `flip-3d/glitch/dissolve/cube` 等需要 `perspective` 的动画，导出 `#stage` 已设 `perspective:1200px`，可直接生效。

### 6.4 导出前强校验

`src/core/exporter/preflight.ts`：
```ts
export interface PreflightWarning { code: ErrorCode; elementId?: string; sceneId?: string; message: string; severity: 'info'|'warn'|'block' }
export function preflightExport(project: ProjectData): PreflightWarning[]
```
- `block` 级（如素材缺失、含未实现导出元素且未确认）：导出流程必须弹出确认，用户选"仍要导出"才继续，并记录 warning 到导出日志。
- `ExportModal.tsx` 在用户点击导出时先跑 `preflightExport` 并展示结果。

### 6.5 导出一致性测试（黄金文件）

- `tests/exporter/consistency.test.ts`：
  - 构造覆盖全部 11 种元素 + 全部动画类型的"黄金工程"。
  - 断言：`elementToDescriptor` 在编辑器与导出两套路径产出**相同**的 style/内容（DOM 与 HTML 各自序列化后归一化对比）。
  - 对每种元素至少 1 条用例；对导出 HTML 校验"所有引用的 keyframe 名在 CSS 中存在"。

### 6.6 DoD

- `npm run lint` 0 error；`npm test` 全绿。
- 手工验证：用示例工程导出单文件 HTML，用浏览器打开，逐项比对：saber 光效、全景图、3D 模型、翻牌器、全部动画类型——与编辑器预览一致；不支持项出现明确提示。
- 导出 5 种基础元素工程，结果与旧版导出**无行为回退**。

---

## 7. 阶段五：Node API 服务（P1）

**目标**：让 AI/CLI/第三方可通过 HTTP 操作 Aether，也是云工程/预览/模板生态的地基。

### 7.1 技术选型与目录

- Express（已装）+ zod（校验）+ `dotenv`（已装）。存储先用**文件存储**（`data/` 目录，JSON 文件 + `assets/` 子目录），数据量上来后换 SQLite 不动接口。
- 新增 `server/`：
```
server/
  index.ts            # 入口：加载 env、启动 http
  app.ts              # 组装 express app（中间件+路由+错误处理）
  routes/
    projects.ts       # 工程 CRUD / 导出 / 渲染
    assets.ts         # 素材上传/读取
    generate.ts       # AI 生成（阶段 8 实现，先返回 501）
    preview.ts        # 预览链接（阶段 9）
    auth.ts           # API Key 校验
  middleware/
    auth.ts           # X-API-Key 校验
    validate.ts       # zod 校验中间件
    error.ts          # AetherError → HTTP
  store/
    fileProjectStore.ts  # 实现 core ProjectStore（文件）
    fileAssetStore.ts
```
- package.json 新增：`"server": "tsx server/index.ts"`。

### 7.2 全局约定

- 基路径：`/api/v1`；所有响应 JSON：`{ "ok": true, "data": ... }` 或 `{ "ok": false, "code": "...", "message": "...", "details": ... }`。
- 鉴权：`X-API-Key` 请求头；Key 来自环境变量 `AETHER_API_KEYS`（逗号分隔多个）；未配置时仅本机 localhost 可访问（开发模式），生产必须配置。
- 错误映射表：

| ErrorCode | HTTP |
|---|---|
| E_VALIDATION | 400 |
| E_SCHEMA_MIGRATION | 400 |
| E_SCHEMA_NEWER | 409 |
| E_AUTH_REQUIRED | 401 |
| E_NOT_FOUND | 404 |
| E_CONFLICT | 409 |
| E_STORAGE_FULL | 507 |
| E_EXPORT_TOO_LARGE | 413 |
| E_EXPORT_UNSUPPORTED | 422 |
| E_AI_TIMEOUT | 504 |
| E_AI_GENERATION_FAILED | 502 |
| E_INTERNAL | 500 |

### 7.3 API 契约（完整）

所有请求体/响应体字段均为强制契约，示例用 `curl` 表达（Windows PowerShell 下 curl.exe 同参）。

**P01 创建工程**
```
POST /api/v1/projects
Body: { "title": "示例", "template": "blank" }   // template: 'blank'|官方模板 id（可选）
201: { "ok": true, "data": { "id": "...", "project": <ProjectData> } }
400: E_VALIDATION
```

**P02 列工程**
```
GET /api/v1/projects
200: { "ok": true, "data": [ { "id","title","updatedAt","sceneCount" } ] }
```

**P03 读工程**
```
GET /api/v1/projects/:id
200: { "ok": true, "data": { "project": <ProjectData> } }
404: E_NOT_FOUND
```

**P04 整体写入 / 更新**
```
PUT /api/v1/projects/:id
Body: 完整 ProjectData
200: { "ok": true, "data": { "project": <ProjectData 归一化后> } }
400: E_VALIDATION（携带 issues）
```

**P05 局部更新（AI 高频）**
```
PATCH /api/v1/projects/:id
Body: { "op": "scene.add"|"scene.update"|"element.add"|"element.update"|"element.delete"|"element.reorder"|"group.add"|"variables.set"|"scene.reorder"|..., "payload": {...} }
200: { "ok": true, "data": { "project": <ProjectData> } }
```
`op` 与 payload 严格映射到 `core/engine/*` 函数签名；未知 op → 400。
示例（新增文本元素到场景 home）：
```
curl -X PATCH http://localhost:3000/api/v1/projects/p1 -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"op":"element.add","payload":{"sceneId":"home","el":{"type":"txt","x":10,"y":20,"w":50,"h":30,"content":"你好","startTime":0,"duration":5,"zIndex":10}}}'
```

**P06 删除工程**
```
DELETE /api/v1/projects/:id
200: { "ok": true, "data": { "deleted": true } }
404: E_NOT_FOUND
```

**P07 导出工程（异步任务）**
```
POST /api/v1/projects/:id/export
Body: { "format": "zip"|"html"|"render", "options": { "license": "free"|"pro"|"enterprise" } }
202: { "ok": true, "data": { "jobId": "...", "status": "pending" } }
```
**P08 查询导出任务**
```
GET /api/v1/projects/:id/export/:jobId
200: { "ok": true, "data": { "status": "pending"|"done"|"failed", "downloadUrl"?: "...", "warnings"?: PreflightWarning[] } }
```
导出前必跑 `preflightExport`；warnings 随任务返回。

**P09 素材上传**
```
POST /api/v1/assets   (multipart/form-data, field: "file")
201: { "ok": true, "data": { "refId": "...", "asset": <AssetEntry> } }
507: E_STORAGE_FULL
```

**P10 素材读取**
```
GET /api/v1/assets/:refId   → 返回文件流（Content-Type 由 mime 决定）
404: E_NOT_FOUND
```

**P11 AI 生成工程**（阶段 8 落地，此阶段占位）
```
POST /api/v1/generate
Body: { "text": "企业介绍文案...", "options": { "style"?: string, "scenes"?: number } }
201: { "ok": true, "data": { "id": "...", "project": <ProjectData> } }
502: E_AI_GENERATION_FAILED / 504: E_AI_TIMEOUT
```

**P12 生成预览链接**（阶段 9 落地）
```
POST /api/v1/projects/:id/preview
Body: { "password"?: string, "expiresInHours"?: number }
201: { "ok": true, "data": { "url": "http://<host>/p/<code>", "code": "..." } }
```

### 7.4 安全

- 路径参数必须校验（防 `..` 路径穿越）；文件下载校验 refId 白名单字符。
- 上传大小限制：单文件 200MB（`express` json/multipart limit 配置）。
- CORS：仅允许配置的 `AETHER_ALLOWED_ORIGINS`（默认编辑器 localhost:3000）。
- 所有写操作写 `access.log`（时间、IP、key 前缀、op、结果）。

### 7.5 DoD

- `npm run server` 启动无报错；用 curl 依序跑通 P01–P10。
- `npm run lint` 0 error；`tests/api/*.test.ts`（supertest）覆盖每端点 happy + error path（含鉴权失败、校验失败、404、幂等）。
- 用 P05 的 PATCH 完成一次"从空工程到含 3 场景 10 元素"的完整构建，证明 API 可独立完成编辑。

---

## 8. 阶段六：CLI 工具（P1）

**目标**：脚本化/批量/AI Agent 稳定调用，确定性操作编辑器。

### 8.1 实现

- 新增 `src/cli/index.ts`；使用 Node 内置 `process.argv` 手写解析（或装 `commander`，二选一，选 commander 则记入依赖）。
- package.json：`"cli": "tsx src/cli/index.ts"`；构建后 `"bin": { "aether": "dist/cli/cli.js" }`（阶段末 `npm run build` 出 `dist` 后可全局安装）。

### 8.2 命令全集（强制）

| 命令 | 参数 | 说明 |
|---|---|---|
| `aether init [dir]` | — | 初始化工程目录（生成 `project.json` + `assets/`） |
| `aether project create --title <t>` | `--title` | 新建工程，输出 `id` |
| `aether project list` | — | 列出工程（表格/JSON） |
| `aether project get <id>` | — | 输出工程 JSON |
| `aether project delete <id>` | `--yes` | 删除（需确认或 `--yes`） |
| `aether scene add --project <id> --alias <n> [--duration <s>]` | — | 新增场景 |
| `aether scene update --project <id> --scene <sid> --alias <n>` | — | 更新场景字段 |
| `aether scene delete --project <id> --scene <sid>` | — | 删除场景 |
| `aether scene list --project <id>` | — | 场景列表 |
| `aether scene reorder --project <id> --order a,b,c` | — | 场景排序 |
| `aether element add --project <id> --scene <sid> --type <t> [--x --y --w --h --content --startTime --duration --zIndex ...]` | — | 添加元素（type ∈ 11 种） |
| `aether element update --project <id> --scene <sid> --el <eid> --set k=v --set k2=v2` | — | 更新元素字段（可多个 `--set`） |
| `aether element delete --project <id> --scene <sid> --el <eid>` | — | 删除元素 |
| `aether element list --project <id> --scene <sid>` | — | 元素列表 |
| `aether asset add --project <id> --file <path> [--kind image]` | — | 导入素材，输出 refId |
| `aether asset list --project <id>` | — | 素材清单 |
| `aether template apply --project <id> --template <tid>` | — | 套用模板 |
| `aether export --project <id> --format zip\|html\|render [--out <dir>] [--license free\|pro]` | — | 导出（内部跑 preflight） |
| `aether validate --file <project.json>` | — | 校验工程，输出 issues |
| `aether ai generate --text "<文案>" [--out <id>]` | — | AI 生成工程（阶段 8） |

### 8.3 输出与退出码规范（强制）

- stdout 只输出**结果**（表格或 `--json` 的结构化 JSON）；stderr 输出错误与日志。
- 退出码：`0` 成功、`1` 业务错误（AetherError，stderr 打印 `[E_CODE] message`）、`2` 参数/用法错误、`3` 内部异常。
- 所有写命令支持 `--dry-run`（打印将执行的变更，不落盘）。
- 所有写命令输出 `id` 便于脚本链式调用。

### 8.4 示例会话（文档测试用）

```
> aether project create --title "客户A展厅"
id: p_xxx
> aether scene add --project p_xxx --alias "01.概念核心" --duration 12
sid: home
> aether element add --project p_xxx --scene home --type txt --x 10 --y 20 --w 50 --h 30 --content "欢迎莅临" --startTime 0 --duration 12
eid: uid_xxx
> aether asset add --project p_xxx --file logo.png
refId: asset_xxx
> aether export --project p_xxx --format zip --out ./out
✓ 导出完成：./out/<title>.zip （warnings: 0）
```

### 8.5 DoD

- 全部命令在示例工程上跑通；`aether export` 产物可被编辑器"导入工程包"反向打开。
- `npm run lint` 0 error；`tests/cli/*.test.ts`：每条命令断言退出码 + `--json` 输出结构。
- 幂等验证：重复执行 `scene add` 同参数两次 → 产生两个不同 id 但均为合法场景（符合 2.4 语义）；`element update` 重复执行结果一致。

---

## 9. 阶段七：MCP Server（P1，AI 原生入口）

**目标**：让 Claude/ChatGPT/豆包等 Agent 对话式操作 Aether。

### 9.1 技术选型

- 官方 `@modelcontextprotocol/sdk`：
  ```bash
  npm install @modelcontextprotocol/sdk
  ```
- 新增 `server/mcp/index.ts`，实现 **stdio transport**（本地 Agent 客户端）+ 可选 `http/sse`。所有工具内部调用 `src/core`（+ 可选调 Node API，二选一，**推荐直接调核心**，减少一层网络与鉴权复杂度）。

### 9.2 MCP 工具清单（name 固定，勿改名；输入输出 JSON 稳定）

| name | description | 输入（JSON Schema 摘要） | 成功输出 |
|---|---|---|---|
| `aether_create_project` | 新建空白工程 | `{ title?: string }` | `{ id, project }` |
| `aether_list_projects` | 列出工程 | `{}` | `[{ id, title, updatedAt, sceneCount }]` |
| `aether_get_project` | 读取工程 | `{ id }` | `{ project }` |
| `aether_add_scene` | 新增场景 | `{ id, alias?, duration? }` | `{ scene }` |
| `aether_update_scene` | 更新场景 | `{ id, sceneId, patch }` | `{ project }` |
| `aether_add_element` | 新增图层 | `{ id, sceneId, element }` | `{ element }` |
| `aether_update_element` | 更新图层 | `{ id, sceneId, elementId, patch }` | `{ project }` |
| `aether_delete_element` | 删除图层 | `{ id, sceneId, elementId }` | `{ project }` |
| `aether_list_elements` | 列出图层 | `{ id, sceneId }` | `[{ element 摘要 }]` |
| `aether_apply_template` | 套用模板 | `{ id, templateId }` | `{ project }` |
| `aether_bind_variable` | 设置全局变量 | `{ id, name, value, type? }` | `{ project }` |
| `aether_validate_project` | 校验工程 | `{ id }` | `{ ok, issues? }` |
| `aether_export_project` | 导出 | `{ id, format: "zip"\|"html"\|"render", license? }` | `{ status, downloadUrl?, warnings? }` |
| `aether_generate_from_text` | AI 生成工程 | `{ text, style?, sceneCount? }` | `{ id, project }` |

### 9.3 工具实现规范

- 每个工具的 `inputSchema` 必须用 JSON Schema 严格声明（含 `additionalProperties: false`）。
- 输出 `content[0].type = "text"`，内容为 JSON 字符串；失败时 `isError = true` 且文本为 `[E_CODE] message`。
- 工具描述（description）要写清楚：参数含义、单位（如 x/y/w/h 为 0-100 百分比、时间秒）、边界。
- 禁止在 MCP 层重写业务逻辑；一律转发核心函数。
- 工作目录/工程上下文：MCP 单次会话绑定一个 `currentProjectId`，通过 `aether_create_project` 或 `aether_get_project` 建立；工具若缺 `id` 则用当前工程。

### 9.4 注册与调试

- 提供 `mcp.json` 示例（供 Claude Desktop / Cursor 等配置）：
  ```json
  { "mcpServers": { "aether": { "command": "node", "args": ["server/mcp/index.js"], "env": { "AETHER_DATA_DIR": "./data" } } } }
  ```
- 调试：`npx @modelcontextprotocol/inspector node server/mcp/index.js`。

### 9.5 DoD

- 用 MCP Inspector 逐个调用全部 14 个工具，happy path + 错误 path 均符合 9.3。
- `npm run lint` 0 error；`tests/mcp/*.test.ts` 用 SDK 的 in-memory 客户端跑工具级测试。
- 端到端：让一个支持 MCP 的 Agent（如 Claude Desktop）通过 `aether_generate_from_text` → `aether_add_element` → `aether_export_project` 完整走通一次。

---

## 10. 阶段八：AI 生成能力落地（Gemini，P1）

**目标**：兑现 metadata 声明的 Server-Side Gemini 能力；文案 → 合法工程数据。

### 10.1 服务端调用规范

- 仅服务端调用 `@google/genai`（浏览器端禁止携带 Key）。
- 新增 `server/services/aiService.ts`：
  ```ts
  export async function generateProjectFromText(text: string, opts?: { style?: string; sceneCount?: number }): Promise<ProjectData>
  ```
  - 读取 `GEMINI_API_KEY`（缺失 → 启动时告警，`/api/v1/generate` 返回 503 配置缺失）。
  - 超时：单次 60s；重试：网络错误重试 1 次（退避 2s）；`E_AI_TIMEOUT` 若超时。
  - 并发/配额：全局信号量限制并发 2；记录每次调用的 token 用量到日志。

### 10.2 生成流程（强制）

```
text + options
  → 构造 messages（SystemPrompt + 用户输入）
  → 模型以 responseSchema 强制输出 JSON（function calling 或 responseMimeType=application/json + responseSchema）
  → JSON.parse
  → zod 校验（ProjectDataSchema）
  → 失败：把校验 issues 回喂给模型，重试 1 次（修正轮）
  → 仍失败：抛 E_AI_GENERATION_FAILED（携带 issues 摘要）
  → 成功：normalizeProjectData → 生成工程 id → 保存 → 返回
```

### 10.3 System Prompt 模板（完整）

```
你是一个专业的大屏演示工程生成器，为「Aether Studio」生成数据。Aether 的工程由 JSON 描述。

【输出格式】只输出一个 JSON 对象，字段必须严格符合以下 TypeScript 接口，禁止输出任何解释文字或 Markdown 代码块。

interface GenResult {
  title: string;                       // 工程标题，8 字以内
  start: string;                       // 起始场景 id
  scenes: Array<{
    id: string;                        // 英文小写短横线，如 "home"
    alias: string;                     // 场景中文名
    duration: number;                  // 秒，8-20
    transitionIn?: string;             // 'fade'|'slide-left'|'slide-right'|'zoom-in'|'none'
    transitionOut?: string;
    bgColor?: string;                  // 十六进制
    els: Array<{
      type: 'txt'|'shape'|'img'|'chart';   // 首版只允许这 4 类
      content?: string;                // 文本内容
      x: number; y: number; w: number; h: number;  // 0-100 百分比
      startTime: number; duration: number;        // 秒
      animType?: 'fade-in'|'slide-up'|'slide-right'|'zoom-in'|'none';
      exitAnimType?: 'fade-out'|'slide-down'|'none';
      color?: string;                  // 文本色
      backgroundColor?: string;        // shape 背景
      fontSize?: number;               // 24-120
    }>;
  }>;
}

【排版规则】
- 每屏信息密度适中，元素 3-8 个；标题+副标题+若干数据卡片+交互按钮为常见结构。
- x/y/w/h 相加不得超出 100；元素之间留白，禁止重叠（背景底除外）。
- 场景时长与元素动画时长协调：元素 startTime 递增、不超出场景 duration。
- 配色建议深色科技风（默认底色 #08080c，主色 #38bdf8），除非用户指定风格。
- 内容必须忠实于用户提供的文案，禁止编造企业数据。

【安全红线】禁止生成：政治敏感、色情、暴力、违法内容；不得生成指向外部不可信 URL 的资源引用。
```

### 10.4 输出校验与兜底（强制）

- 生成结果**必须**通过 `normalizeProjectData`；不通过绝不写盘。
- 对模型输出的数值做二次安全夹取：`x/y/w/h ∈ [0,100]`、`fontSize ∈ [8,400]`、`duration ∈ [1,300]`、`startTime ≥ 0`（在 zod 基础上再加一层防御，防模型边界值）。
- 所有生成失败路径返回 `E_AI_GENERATION_FAILED`，message 给出原因（校验失败 / 格式错误 / 超时），**禁止返回半成品工程**。

### 10.5 安全与内容合规

- 调用前对 `text` 做基础内容安全检查（拒绝明显违规输入，命中即返回 `E_VALIDATION` 且不调用模型）。
- 记录 `{ time, textLen, model, tokensIn, tokensOut, ok }` 审计日志。
- 不把用户输入回显到公开日志；`text` 含敏感信息时脱敏。

### 10.6 DoD

- 配置 `GEMINI_API_KEY` 后，`POST /api/v1/generate` 用一段示例文案返回合法工程；编辑器可打开该工程。
- 用"空文案/超长文案/明显违规文案"验证错误路径（E_VALIDATION / E_AI_GENERATION_FAILED）。
- `npm run lint` 0 error；`tests/ai/generate.test.ts`：mock 模型返回非法 JSON/非法数据 → 断言走修正/失败路径，**无半成品落盘**。

---

## 11. 阶段九：商业化功能（P1）

### 11.1 水印与授权

- 授权模型：`license: 'free' | 'pro' | 'enterprise'`（存 `ProjectData.branding.license`）。
- 导出时按 license 处理（在 `core/exporter` 统一实现，编辑器导出与 API 导出共用）：
  - `free`：播放器 HUD 左下角叠加水印 `Powered by Aether Studio`；导出 ZIP 时注入 `LICENSE.txt`。
  - `pro` / `enterprise`：无水印。
- `ExportModal.tsx` 展示当前 license 状态与升级引导（占位链接）。

### 11.2 模板系统

- 模板 = 完整 ProjectData 或"场景级片段"。
- 模板元数据 schema（新增 `src/core/schema/template.ts`）：
  ```ts
  export interface TemplateMeta { id: string; name: string; category: string; tags: string[]; thumbnail?: string; license: 'free'|'pro'; scenes: number; version: number; }
  export interface AetherTemplate { meta: TemplateMeta; data: ProjectData | { scenes: Scene[]; start: string } }
  ```
- 模板目录：`templates/`（每个模板一个子目录，含 `template.json` + `thumb.png` + `assets/`）。
- `core/engine/template.ts`：`applyTemplate(project, template, opts)` 提供"整工程替换"与"导入场景到当前工程"两种模式；导入场景时必须重新生成 scene/element id 防冲突。
- 官方内置模板 ≥ 5 套（深色科技 / 白色商务 / 节日庆典 / 数据大屏 / 企业介绍）。

### 11.3 云工程与预览链接

- 依赖阶段五 API 的工程 CRUD + 导出渲染。
- 预览链接：`POST /api/v1/projects/:id/preview` 生成短码 `code`（6 位随机），存 `previews` store；`GET /p/:code` 返回只读播放器页（渲染 `format=render` 的产物）；支持 `password`（会话 Cookie）与 `expiresInHours`（过期后 410）。
- 播放器页禁用右键、禁选、隐藏地址栏细节，适配展厅大屏与手机。

### 11.4 订阅分层功能矩阵（定价参考，实现时以常量配置）

| 能力 | free | pro | enterprise |
|---|---|---|---|
| 编辑器全部功能 | ✅ | ✅ | ✅ |
| 导出水印 | 有 | 无 | 无 |
| 高级元素导出（saber/3D/全景/高斯泼溅） | ⚠️ 受限 | ✅ | ✅ |
| 云工程存储 | 1 个 | 50 个 | 无限 |
| 模板库 | 基础 | 全部 | 全部 + 私有模板 |
| 在线预览链接 | ✕ | 10 个/月 | 无限 + 密码/有效期 |
| API / CLI / MCP | ✕ | ✅ | ✅ + 私有化部署 |
| 团队协作 | ✕ | ✕ | ✅（多人 + 权限） |

### 11.5 DoD

- 导出带水印的 free 版与无水印 pro 版，肉眼可辨且不影响正常演示。
- 模板库 ≥ 5 套，`aether template apply` 与 API PATCH `template.apply` 均可套用且不产生 id 冲突。
- 预览链接生成、密码校验、过期返回 410 全链路通过。
- `npm run lint` 0 error；相关测试补齐（水印注入、模板应用、预览过期）。

---

## 12. 测试与质量门禁（贯穿全部阶段）

### 12.1 框架

- 安装 `vitest` + `supertest`（API 测试）+ `@modelcontextprotocol/sdk` 的测试工具。
  ```bash
  npm install -D vitest supertest @types/supertest
  ```
- `package.json`：`"test": "vitest run"`、`"test:watch": "vitest"`。
- 测试目录：`tests/`（顶层），按 `schema/ engine/ exporter/ history/ api/ cli/ mcp/ ai/` 组织。

### 12.2 覆盖率要求（核心模块硬指标）

- 目标：`src/core/**` 行覆盖率 ≥ 80%（vitest coverage 配置 `include: ['src/core/**']`）。
- 必测清单（优先级从上到下）：
  1. schema：normalize 全分支、迁移幂等、校验 issue 路径格式
  2. engine：全操作 + 边界（B1–B14 对应用例）
  3. history/patchStore：构建↔回退一致性（随机工程往返测试）
  4. exporter：黄金工程 11 种元素 + 动画 keyframe 覆盖断言
  5. variables/resolve：绑定缺失/非法值/多变量
  6. api：每端点 happy + error
  7. cli：每命令退出码 + JSON
  8. mcp：每工具输入输出 + isError

### 12.3 CI（GitHub Actions `.github/workflows/ci.yml`）

- 触发：push / PR。
- 步骤：`npm ci` → `npm run lint` → `npm test` → `npm run build`。
- 门禁：lint 0 error、测试全绿、核心覆盖率 ≥ 80%；任一失败阻断合并。

### 12.4 最终验收清单（发布前逐项打勾）

- [ ] `npm run lint` 0 error
- [ ] `npm test` 全绿 + 覆盖率达标
- [ ] `npm run build` 成功，`dist/` 可部署
- [ ] 编辑器：新建→编辑→撤销重做→导出→导入回读，全链路正常
- [ ] 导出一致性：黄金工程在编辑器与导出播放器表现一致；不支持项有明示
- [ ] API：P01–P12 全部可用，鉴权生效，错误码规范
- [ ] CLI：全部命令可用，`--json` 输出稳定，退出码规范
- [ ] MCP：14 个工具被 Agent 端到端调用成功
- [ ] AI 生成：示例文案产出合法工程；无半成品落盘
- [ ] 商业：水印/模板/预览链接全链路通过
- [ ] 文档：README 更新（启动、API、CLI、MCP、配置项、环境变量）

---

## 13. 里程碑与排期（建议）

| 里程碑 | 内容 | 依赖 | 建议周期 | DoD |
|---|---|---|---|---|
| M0 | 阶段零 Schema（§1 + §2 错误体系） | — | 3 天 | §1.7 DoD |
| M1 | 阶段一 Headless 核心（§3） | M0 | 5 天 | §3.4 DoD |
| M2 | 阶段四 导出一致性（§6） | M1 | 5 天 | §6.6 DoD |
| M3 | 阶段二 状态管理拆分（§4） | M1 | 4 天 | §4.3 DoD |
| M4 | 阶段三 存储与历史（§5） | M1 | 3 天 | §5.4 DoD |
| M5 | 阶段五 API（§7） | M1, M4 | 4 天 | §7.5 DoD |
| M6 | 阶段六 CLI（§8） | M1 | 2 天 | §8.5 DoD |
| M7 | 阶段七 MCP（§9） | M5/M6 | 2 天 | §9.5 DoD |
| M8 | 阶段八 AI 生成（§10） | M5 | 3 天 | §10.6 DoD |
| M9 | 阶段九 商业化（§11） | M2, M5 | 4 天 | §11.5 DoD |

> 关键路径：M0→M1→M2（先把"编辑=导出"一致性做对，保信誉）；M1→M4→M5→M7/M8（AI 生态能力）。M3（拆分）可与 M5 并行。

---

## 14. 风险与注意事项

| 风险 | 影响 | 对策 |
|---|---|---|
| 现有 `App.tsx` 逻辑复杂，抽 core 时改出行为差异 | 功能回退 | 迁移前补回归测试；一次改一个操作 |
| 导出现有 5 种元素在重构后行为变化 | 存量交付物不一致 | 6.5 黄金文件 + 旧产物对比 |
| IndexedDB 迁移失败 | 用户素材丢失 | 迁移前完整备份旧库；失败保留旧库不删除 |
| Gemini Key 泄露 / 配额超限 | 安全/成本 | Key 仅服务端；并发限流；用量日志告警 |
| MCP 工具被 Agent 误用 | 数据被意外修改 | 工具描述明确边界；`--dry-run`/确认语义；写操作记日志 |
| AI 生成数据边界值 | 工程渲染异常 | 10.4 双层夹取 + zod |
| 多人并发写同一工程 | 覆盖丢失 | 2.4 幂等 + updatedAt 乐观锁（B8） |
| 单文件 HTML 过大 | 打不开 | preflight 限 15MB，超限引导 ZIP（现有逻辑保留） |

---

## 附录 A：现有代码关键事实速查（给执行 AI 的索引）

- 类型定义唯一处：`src/types/index.ts`（勿删，核心层新 schema 由其扩展）。
- 示例工程：`src/utils/defaultData.ts`（`DEFAULT_PROJECT_DATA`）。
- 素材库：`src/utils/db.ts`（`dbManager`：`init/put/get/loadUrl/register/getBlob/getAllKeys/delete`）。
- 导出三函数：`src/utils/export.ts`（`generateStandaloneHTML` / `exportProjectZip` / `exportSingleFileHTML`）。
- 图表：`src/utils/chartCore.ts`（`buildChartSVG` / `CHART_RUNTIME_JS`）。
- 光效预设：`src/utils/saberPresets.ts`（`SABER_SHAPE_PRESETS` / `SABER_STYLE_THEMES`）。
- 3D 渲染：`src/components/ThreeCanvas.tsx`（全景/模型/高斯泼溅统一 WebGL 层）。
- 环境变量：`.env.example`（`GEMINI_API_KEY`、`APP_URL`）。
- 声明能力：`metadata.json`（`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`）。

## 附录 B：环境变量总表

| 变量 | 用途 | 必填 |
|---|---|---|
| `GEMINI_API_KEY` | AI 生成服务端调用 | M8 起必填 |
| `AETHER_API_KEYS` | API 访问密钥（逗号分隔） | 生产必填 |
| `AETHER_DATA_DIR` | 服务端数据目录（默认 `./data`） | 否 |
| `AETHER_ALLOWED_ORIGINS` | CORS 白名单 | 生产建议 |
| `APP_URL` | 服务自身 URL（预览链接拼接用） | M9 起 |

## 附录 C：变更记录

| 日期 | 版本 | 说明 |
|---|---|---|
| 2026-08-29 | v1.0 | 初稿：M0–M9 全量实施方案 |
| 2026-08-29 | M0 已实施 | 阶段零（Schema 稳定化）完成：新增 `src/core/`（errors/id/logger/schema），zod 校验 + v42→v43 迁移 + 温和修复 + normalizeProjectData 唯一入口；App.tsx 读取/自动保存接入（key `aether_desktop_project_v43`）；db.ts 换新库 `AetherDesktopDB_v43` 并一次性迁移旧库；vitest 配置完成，`tests/schema/normalize.test.ts` 10 用例全绿；lint 0 error；build 通过；dev 冒烟 HTTP 200。下一步：M1（阶段一 Headless 核心 engine 抽离）。 |
