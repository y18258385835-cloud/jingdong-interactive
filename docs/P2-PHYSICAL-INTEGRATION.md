# P2 物理设备接口预留与后续联调说明

P2 当前只验收软件接口和演示数据，不要求现在接入物理设备。物理设备联调放到后续 P3，当前代码已经预留统一适配器接口：

- `src/core/realtime/device-adapter.ts`
- `DeviceSourceConfig`：租户、数据源、协议和服务端密钥引用
- `DeviceTelemetryEvent`：统一设备状态、指标、时间和序列号
- `DeviceAdapter`：连接、断开、消息标准化和健康检查

## 推荐的第一套设备

为了降低第一次联调难度，建议使用“模拟器 + 网关”开始，不要一上来接生产设备。

| 用途 | 推荐型号/软件 | 连接方式 |
| --- | --- | --- |
| MQTT 入门 | Raspberry Pi 4B + Node-RED + Mosquitto | 网线或 Wi-Fi，MQTT 5 |
| 工业数字量/模拟量 | Siemens S7-1200 CPU 1212C + Kepware 或 Node-RED | 以太网，OPC UA 或 Modbus TCP |
| 充电桩场景 | OCPP 1.6J 模拟器；有条件再用 Teltonika TSC100 | WebSocket，OCPP 1.6J |
| 工业网关 | Moxa UC-8200 或 Advantech UNO-1372G | 网线，网关主动上送 |

型号是联调参考，不代表当前项目已经连接这些设备，也不要求现在采购。

## 傻瓜式联调方法

1. 先在电脑上启动 Mosquitto 或 Node-RED，确认能看到一条测试消息。
2. 给测试设备配置唯一 `deviceId`，例如 `demo-line-001`。
3. 创建数据源：协议、服务器地址、端口和账号密码只放服务端密钥仓库，项目文件只保存 `sourceId` 和 `secretRef`。
4. 让设备每 2 秒发送一条标准化前的原始消息。
5. 编写对应 `DeviceAdapter.normalize()`，把原始消息转换成 `DeviceTelemetryEvent`。
6. 由 BFF 按 `tenantId + sourceId + deviceId` 写入当前状态，再推送给实时看板。
7. 依次拔网线、恢复网线、重启网关、发送重复消息和乱序消息，确认页面分别显示离线、恢复、去重和新状态。
8. 最后再换成真实设备证书和生产数据源，先只读观察，不直接执行控制命令。

## 推荐测试消息

```json
{
  "eventId": "evt-000001",
  "deviceId": "demo-line-001",
  "status": "running",
  "occurredAt": "2026-09-12T09:00:00.000Z",
  "sequence": 1,
  "metrics": { "powerKw": 12.4, "temperatureC": 31.2 }
}
```

适配器负责补齐 `tenantId`、`sourceId` 和 `protocol`，服务端不接受设备自行声明其他租户。

## 本地模拟命令

先启动本机 Mosquitto（默认 `mqtt://127.0.0.1:1883`），再运行：

```powershell
npm run realtime:simulate
```

自定义参数示例：

```powershell
$env:MQTT_BROKER_URL = 'mqtt://127.0.0.1:1883'
$env:MQTT_TENANT_ID = 'tenant-demo'
$env:MQTT_SOURCE_ID = 'mqtt-demo'
$env:MQTT_SIMULATOR_COUNT = '10'
npm run realtime:simulate
```

看到 `1/10` 到 `10/10`，说明“模拟设备 → MQTT Broker”正常。适配器单元测试验证的是“Broker → 统一事件”这半段；真正把事件写入生产状态存储属于 P3.2。

## 现在不用做的事

- 不需要现在购买物理设备。
- 不需要现在接入 Broker、PLC 或充电桩。
- 不需要把设备密码写进工程 JSON 或浏览器 localStorage。
- 不允许用物理设备联调替代 P2 软件验收。
