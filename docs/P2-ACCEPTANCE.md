# P2 验收包

## 当前代码门禁

- `npm run lint`
- `npm test`
- `npm run build`
- `GET /screen` 返回 200
- `GET /api/health` 返回 200

当前自动化结果：6 个测试文件、34 个用例通过；类型检查和构建通过。

## 六项验收记录

| 项目 | 代码证据 | 现场验收要求 | 状态 |
| --- | --- | --- | --- |
| 业务输入 | 数据源、协议、租户和状态字段已定义接口 | 以后接真实设备时再填写设备清单和业务口径 | P2 代码通过 |
| 故障场景 | 断线重连、令牌失效、快照补偿、REST 失败和离线缓存 | 真实设备演练属于 P3，可不阻塞 P2 | P2 代码通过 |
| 1000 条更新 | 顺序处理、去重和旧帧丢弃测试 | 真实浏览器压测属于 P3，可不阻塞 P2 | P2 代码通过 |
| 租户隔离 | 生产令牌必须由受信身份 JWT 签发，租户取自 JWT | 以后接真实 IdP 时做现场账号验证 | P2 代码通过 |
| 导出脱敏 | ZIP、HTML、JSON 导出统一递归删除密钥和内网连接信息 | 产物级自动测试已覆盖 | P2 代码通过 |
| 演示/生产隔离 | 生产无 REST 或上游失败无缓存时返回 503，Mock 只在非生产 | 生产部署演练属于上线前检查 | P2 代码通过 |

## 生产必需配置

```text
NODE_ENV=production
REALTIME_REST_URL=https://真实数据源/api/v1/snapshot
REALTIME_REST_BEARER=服务端专用短令牌
REALTIME_TOKEN_SECRET=随机高熵签名密钥
REALTIME_IDENTITY_SECRET=与身份服务约定的 HS256 验证密钥
```

生产令牌接口要求 `Authorization: Bearer <identity-jwt>`。JWT 必须包含：

- `sub`：用户或服务主体
- `tenantId`：合法租户 ID
- `scope`：包含 `realtime:read`
- `exp`：未过期
- 可选 `sourceIds`：允许访问的数据源列表

没有身份令牌或签名密钥时，接口会拒绝授权，不会降级为演示数据。

## 后续联调，不作为 P2 阻塞项

1. 选择协议和测试设备。
2. 配置网关、Broker 或 OPC UA/Modbus 连接。
3. 实现 `DeviceAdapter.normalize()`。
4. 做断网、恢复、重复和乱序消息测试。
5. 再接真实 IdP、真实数据源和生产设备。
