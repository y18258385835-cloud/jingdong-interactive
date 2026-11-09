# Microsoft Store build notes

The project currently has no Rust toolchain or Tauri CLI installed, so this workspace does not contain a finished signed Store package. The reproducible build entry point is `build-store.ps1`.

The script produces a Tauri MSI in `store-package/artifacts`. Before Store submission, use the Windows MSIX Packaging Tool or the Partner Center Win32 packaging flow. For a true MSIX submission, replace the package identity fields with the values assigned by Partner Center and complete Windows App Certification Kit checks.

The cloud API is supplied at build time:

```powershell
.\store-package\build-store.ps1 -ApiBaseUrl "https://api.example.com"
```

The corresponding admin URL is `https://api.example.com/admin/licenses`. Keep the admin password, license secret, and `data/licenses.json` on the server only.

On the API server, include the packaged app origin in `CORS_ORIGINS` (normally `http://tauri.localhost`; keep `tauri://localhost` as well for older Tauri runtimes):

```text
CORS_ORIGINS=https://your-web-site.example,http://tauri.localhost,tauri://localhost
```
