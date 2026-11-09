# AETHER 安全复核报告

审计日期：2026-09-21  
范围：React/Vite 编辑器、Express 授权与 AI 代理服务、实时数据服务、部署配置。  
结论：依赖层当前未发现已知生产漏洞（`npm audit --omit=dev` 为 0），但工程不能以当前状态直接公网部署。最优先的问题是导入工程内的自定义代码能够在编辑器同源页面执行。

## 已确认漏洞

### SEC-001：导入的自定义代码可在编辑器主页面执行

- 严重性：严重
- 位置：[src/components/TransparentCustomCodeFrame.tsx](src/components/TransparentCustomCodeFrame.tsx#L136) `eval`、[src/components/TransparentCustomCodeFrame.tsx](src/components/TransparentCustomCodeFrame.tsx#L147) `new Function`、[src/components/CanvasViewport.tsx](src/components/CanvasViewport.tsx#L3779) 禁用 iframe 隔离。
- 证据：自定义组件的 HTML 经 `shadow.innerHTML` 插入，JS 经 `new Function(...)` 执行；事件属性最终由 `eval(source)` 执行。Shadow DOM 仅隔离样式，并不隔离 JavaScript 权限。
- 影响：攻击者只需诱导用户打开一个构造过的工程/ZIP，就可能读取同源 `localStorage` 中的授权、BYOK API Key 和工程数据，篡改编辑器状态，或以用户身份发起请求。授权 token 在本地存储使影响进一步扩大。
- 最小修复：恢复沙箱 iframe 路径，使用 `sandbox` 且不加 `allow-same-origin`；只通过严格校验的 `postMessage` 传递尺寸、文本编辑和诊断事件。不能为了透明画布或文字编辑退回同源执行。
- 纵深防护：在导入、复制、历史恢复、库加载四个入口均重新调用同一份 `inspectCustomCode`；对 HTML 使用 allowlist 清洗器，而不是依赖正则黑名单。

### SEC-002：授权“签名校验”并未校验密码学签名

- 严重性：高
- 位置：[src/core/auth/subscriptionService.ts](src/core/auth/subscriptionService.ts#L173)。
- 证据：`verifySignature()` 只判断 `signature`、`userId`、`plan`、`expiresAt` 是否存在，未校验签名内容。
- 影响：前端缓存的授权数据可以被本地篡改。服务端导出接口目前仍会重新授权，因此这不会单独绕过服务端导出；但会误导前端功能门禁，并为后续前端保护功能留下绕过入口。
- 最小修复：前端不再将本地缓存当作授权事实；导出及受保护 API 均以服务端短期令牌为唯一依据。若需要离线展示，服务端用 ECDSA/RSA 签名，前端以嵌入的公钥使用 `crypto.subtle.verify` 校验。

### SEC-003：工程导入路径未强制执行自定义代码审查

- 严重性：高
- 位置：[src/core/schema/validate.ts](src/core/schema/validate.ts#L240) 至 263；审查器仅在 [src/utils/customCode.ts](src/utils/customCode.ts#L33) 定义，界面编辑弹窗才调用。
- 证据：Zod schema 只限制 `html`、`css`、`js` 的类型与长度，没有在工程解析完成后调用 `inspectCustomCode()`。构造 JSON/ZIP 可绕过编辑界面拦截，随后进入 SEC-001 的执行链。
- 影响：不能把“用户没有在界面里输入代码”当作可信边界；共享工程、模板、历史备份都是攻击载体。
- 最小修复：在工程规范化/导入的唯一边界，拒绝含审查错误的自定义代码，并将旧工程改为“需确认的受限模式”，不能自动执行。

### SEC-004：授权和管理员令牌存放在 Web Storage

- 严重性：中
- 位置：[src/core/auth/subscriptionService.ts](src/core/auth/subscriptionService.ts#L323) 至 331；[server/license-admin.html](server/license-admin.html#L31) 至 43。
- 证据：用户授权 token 使用 `localStorage`，管理员会话 token 使用 `sessionStorage`，前端脚本均可读取。
- 影响：任意同源脚本执行漏洞都能窃取令牌。结合 SEC-001，风险是现实可利用的。
- 最小修复：管理员后台改为 `HttpOnly; Secure; SameSite=Lax` cookie，并在所有写操作校验 Origin/CSRF token；普通导出授权使用短期、最小权限、服务端验证的令牌，浏览器内存保存优先于持久存储。
- 说明：仅替换存储位置不能解决 SEC-001，必须先切断同源任意代码执行。

### SEC-005：`/api/open-folder` 可被任意请求调用并影响服务器桌面

- 严重性：中
- 位置：[server/index.js](server/index.js#L248) 至 263。
- 证据：接口不要求管理员身份或本机来源；只校验参数为存在的绝对目录，随后调用系统文件管理器。
- 影响：服务进程位于服务器或有人登录的桌面主机时，外部请求可反复触发打开任意可访问目录，造成骚扰、资源消耗或操作员诱导。该功能不应存在于公网服务。
- 最小修复：生产环境完全不注册该路由；仅桌面本地模式开启，并同时限制 loopback 地址、固定允许目录和一次性本机能力令牌。

### SEC-006：实时 Prometheus 指标公开暴露

- 严重性：中
- 位置：[server/realtime-service.js](server/realtime-service.js#L193) 至 194。
- 证据：`GET /metrics` 没有认证或网络来源限制；同文件的业务快照接口则要求实时 token。
- 影响：公网访问者可获得运行状态、吞吐、时延、设备运行相关指标，便于侦察和容量攻击。
- 最小修复：在公网应用层禁用该路由；如监控系统需要抓取，只允许监控网段、mTLS 或独立认证。

### SEC-007：兑换码与管理员登录限流无法跨实例生效

- 严重性：中
- 位置：[server/index.js](server/index.js#L161) 至 172；[server/index.js](server/index.js#L195) 与 227。
- 证据：限流计数放在单 Node 进程的 `Map` 中；应用重启、负载均衡到其他实例都会清空或绕过计数。
- 影响：部署多实例或遭遇重启时，管理员密码与兑换码接口更容易被分布式暴力尝试。
- 最小修复：生产环境将计数迁移至 Redis/网关限流，分别以 IP、兑换码/账号和失败次数限流；保留当前内存限流作为本地开发兜底。

## 部署前必须核验

### SEC-008：编辑器静态站点的安全响应头不在仓库中可验证

- 严重性：中
- 位置：[index.html](index.html#L1)；[server/index.js](server/index.js#L130) 至 135 仅覆盖 Express 响应，当前代码未见由 Express 托管 Vite `dist`。
- 事实：服务端已设置 `nosniff`、拒绝嵌入、Referrer-Policy 和 Permissions-Policy；Vite 构建关闭 source map（[vite.config.ts](vite.config.ts#L15) 至 17）。
- 待核验：实际网站目录由 Nginx、IIS、CDN 或其他静态站点服务时，是否为编辑器 HTML 设置 CSP、`X-Content-Type-Options`、`frame-ancestors`/`X-Frame-Options`、`Referrer-Policy`，并全站 HTTPS。
- 建议：先以 CSP Report-Only 观测，再执行白名单 CSP。SEC-001 清除前，CSP 不能采用 `unsafe-eval`。

### SEC-009：单机文件账本与内存管理员会话不适合高可用部署

- 严重性：中
- 位置：[server/license-service.js](server/license-service.js#L35) 至 47；[server/license-service.js](server/license-service.js#L275) 至 292。
- 事实：代码本身已注释说明这是单进程文件存储；管理员 session 使用内存 `Map`，服务重启后失效，多实例间不共享。
- 影响：不是直接越权漏洞，但多机部署会产生兑换码状态分叉、会话随机失效和撤销不同步。
- 建议：上线多实例前迁移到事务型数据库保存兑换码，Redis/数据库保存会话与限流状态，并为授权台账做受控备份与恢复演练。

## 已确认的正向防护

- `.env` 被 `.gitignore` 排除，未发现前端 `VITE_*` 中嵌入服务端密钥的证据；报告不记录任何本地密钥值。
- `npm audit --omit=dev`：0 个已知生产依赖漏洞。
- 构建关闭 source map：`vite.config.ts` 的 `build.sourcemap: false`。
- 服务端外部 URL 请求限制 HTTPS、拦截私有/本机 IP，并设置上游请求与响应大小限制。
- 兑换码只保存 HMAC 派生值而非明文，管理员密码比较使用 `timingSafeEqual`。
- 授权导出由服务端 `/api/v1/export/authorize` 执行，前端门禁目前不是唯一判定点。

## 修复顺序与验收

1. 先处理 SEC-001 和 SEC-003：导入恶意工程时不得在主页面执行脚本，旧自定义组件仍能以受限 iframe 正常预览、编辑与导出。
2. 再处理 SEC-002 与 SEC-004：篡改浏览器存储不会取得有效导出授权；窃取浏览器存储也不能取得管理员会话。
3. 处理 SEC-005 至 SEC-009：公开接口收口、生产级共享限流/存储和反向代理响应头。
4. 为每项增加自动化回归测试：恶意工程导入、伪造授权缓存、未认证本地能力调用、未认证 metrics、跨进程限流。

本报告只包含代码可验证结论；未对生产域名、反向代理、WAF、TLS 证书和防火墙做假设。
