# Microsoft Store 打包目录

该目录用于生成 Windows Store 版本。应用前端从云端 API 读取授权、通知和后台配置；后台管理页面固定为：

```text
<后台地址>/admin/licenses
```

## 构建前提

- Windows 10/11
- Node.js 18+
- Rust 工具链（`rustup`、`cargo`）
- WebView2 Runtime
- Microsoft Partner Center 账号

## 构建

在项目根目录执行：

```powershell
.\store-package\build-store.ps1 -ApiBaseUrl "https://api.example.com"
```

脚本会：

1. 生成使用指定 API 地址的生产前端；
2. 将前端资源复制到 `store-package\dist`；
3. 调用 Tauri 生成 MSIX；
4. 将安装包输出到 `store-package\artifacts`。

不要把真实密码、API Key 或 `data/licenses.json` 放入这个目录或安装包。后台密码只在服务器环境变量中配置。

## Store 提交

生成的 `.msix`/`.msixbundle` 仍需在 Partner Center 完成应用身份关联、截图、隐私政策和认证测试。Store 会为 MSIX 重新签名；官网直传的 EXE/MSI 不属于本流程。
