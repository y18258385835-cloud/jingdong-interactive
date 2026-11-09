# 鲸动交互平台服务器部署包

这是从软件工程复制出的独立服务器部署目录，官网项目单独放在同级 `jingdongnet/`。软件开发源工程仍保留在原目录。

## 结构

- `src/`、`public/`、`index.html`、`vite.config.ts`：浏览器编辑器与生产前端构建配置。
- `server/`：Express API、注册码验证与管理服务、实时数据服务。
- `scripts/`：本地授权服务启动/初始化脚本。
- `data/`：运行时账本目录；部署前确认此目录位于持久化磁盘。
- 根目录 `package.json` 和锁文件：安装依赖、构建和启动命令。

## 服务器部署

需要 Node.js 20+、可持久化磁盘和 HTTPS 反向代理。

1. 将本目录上传服务器，复制 `.env.example` 为 `.env` 并配置强随机 `LICENSE_SECRET`、`LICENSE_ADMIN_PASSWORD`、`LICENSE_DATA_PATH`、`CORS_ORIGINS`。AI 和 MQTT 能力按需配置各自密钥/连接参数。
2. 运行 `npm ci` 和 `npm run build`。
3. 使用进程管理器以 `NODE_ENV=production npm run server` 启动 API（默认监听 8080）；反向代理 `/api` 和 `/admin/licenses` 至该 API。
4. 将 `dist/` 作为 HTTPS 静态站点发布，客户端的 `VITE_API_BASE_URL` 指向该 API 域名，然后按 `LOCAL-DEPLOYMENT.md` 与 `tests/release-regression.md` 验收浏览器权限、授权、导出和恢复。

当前软件是浏览器 Web 应用，不是可直接运行的单一可执行程序。仅将 `dist/` 上传不会提供注册码校验等 API；正式使用必须部署 `server/` 并正确设置密钥、数据库/持久化卷和 HTTPS。AI 生成等功能还需单独配置供应商 API 凭据。

**安全边界：** 不要把 `.env`、`data/licenses.json`、Node 依赖、测试输出或授权数据库提交到公开静态站点或源码仓库。部署前运行 `npm run test:release` 并在目标服务器完成回归验收。
