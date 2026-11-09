# 本地部署

运行 `start-local.ps1` 可一键启动前端和 AI 代理：

```powershell
powershell -ExecutionPolicy Bypass -File .\start-local.ps1
```

端口被占用时脚本会明确报错，可指定 `-FrontendPort 3010 -ProxyPort 8090` 使用备用端口。首次运行需要允许 Node.js 访问本机网络；浏览器若提示摄像头/麦克风权限，体感控制功能需要选择“允许”，不使用时可以拒绝。工程编辑、导入导出和已缓存资源支持离线使用；AI 生成、服务端授权验证和外部链接需要网络，授权离线宽限期以最近一次服务端签发凭证为准。
# 数据边界与发布门禁

当前工程数据保存在用户浏览器的 IndexedDB/OPFS 中，不包含云端同步、历史版本或多人协作；用户应自行导出 `.aether` 工程作为备份。上线前如需要跨设备恢复或团队协作，必须另行建设账户、项目存储、版本策略和灾备，不能将本地缓存视为服务器备份。

部署生产版本前执行：

```powershell
npm run test:release
```

命令通过后，再按 `tests/release-regression.md` 在目标部署环境完成手工验收。`npm run test:release` 会运行完整自动化测试、类型检查、生产构建和生产依赖安全审计；`npm run test:regression` 只适合开发阶段的快速检查。

# 兑换码后台

部署前，在服务器环境变量中配置 `LICENSE_SECRET` 和 `LICENSE_ADMIN_PASSWORD`，并将 `LICENSE_DATA_PATH` 放到持久化磁盘。建议生产环境同时启用 `LICENSE_HTTP_ONLY_COOKIE=true`，前端构建时设置 `VITE_LICENSE_HTTP_ONLY_COOKIE=true`，让许可证令牌不进入浏览器脚本可读存储。若静态站点与 API 跨站部署，再设置 `LICENSE_COOKIE_SAMESITE=None` 并确保 HTTPS。后台地址是：

`https://你的域名/admin/licenses`

后台可批量生成、下载 CSV、查看兑换状态及撤销授权。兑换码明文仅在生成页面显示一次；`data/licenses.json` 是授权账本，应纳入服务器备份，不能提交到仓库。单实例部署可使用当前 JSON 存储；横向扩容前必须迁移到共享数据库或 Redis。
