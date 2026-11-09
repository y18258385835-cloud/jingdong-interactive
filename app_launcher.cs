using System;
using System.IO;
using System.Net;
using System.Diagnostics;
using System.Threading;
using System.Text;
using System.Collections.Generic;
using System.Windows.Forms;
using System.Drawing;

namespace AetherLauncher
{
    static class Program
    {
        private static Process _nodeProcess = null;
        private static Process _browserProcess = null;
        private static HttpListener _listener = null;
        private static volatile bool _running = true;
        private static string _appDir = "";
        private static string _distDir = "";
        private static int _port = 3388;
        private static NotifyIcon _trayIcon = null;
        private static string _targetUrl = "";
        private static string _browserPath = "";
        private static string _userDataDir = "";

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            try
            {
                _appDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\', '/');
                _distDir = Path.Combine(_appDir, "dist");

                // 1. 后台静默启动 Node.js AI 代理服务 (8080)
                StartNodeBackend();

                // 2. 启动内置极速 Web 服务器 (用于本地分发 dist)
                StartWebServer();

                // 3. 寻找系统 Edge / Chrome
                _browserPath = FindBrowser();
                _targetUrl = "http://127.0.0.1:" + _port + "/";
                _userDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AetherInteractiveApp");

                // 4. 创建系统托盘图标
                SetupTrayIcon();

                // 5. 调起独立 App 模式窗口
                LaunchAppWindow();

                // 6. 启动进程监视线程 (当独立窗口关闭且无其它活跃连接时安全退出)
                Thread monitorThread = new Thread(MonitorLifecycle);
                monitorThread.IsBackground = true;
                monitorThread.Start();

                // 运行 Windows Forms 消息循环以支持托盘与系统消息
                Application.Run();
            }
            catch (Exception ex)
            {
                try { File.WriteAllText(Path.Combine(_appDir, "launch_error.log"), ex.ToString()); } catch { }
            }
            finally
            {
                Cleanup();
            }
        }

        /// <summary>
        /// 解析 Node 运行时：优先使用随安装包分发的 runtime\node.exe，
        /// 其次 node\node.exe，最后才回退到系统 PATH。缺失时给出明确提示，
        /// 而不是静默失败让用户只看到"导出失败"。
        /// </summary>
        private static string ResolveNodeExecutable()
        {
            string[] bundled =
            {
                Path.Combine(_appDir, "runtime", "node.exe"),
                Path.Combine(_appDir, "node", "node.exe"),
            };
            foreach (string candidate in bundled)
            {
                if (File.Exists(candidate)) return candidate;
            }
            string pathVariable = Environment.GetEnvironmentVariable("PATH") ?? "";
            foreach (string dir in pathVariable.Split(Path.PathSeparator))
            {
                if (string.IsNullOrWhiteSpace(dir)) continue;
                try
                {
                    string candidate = Path.Combine(dir.Trim(), "node.exe");
                    if (File.Exists(candidate)) return candidate;
                }
                catch { }
            }
            return null;
        }

        private static void StartNodeBackend()
        {
            // 安装包不再携带 node_modules：优先运行打包后的单文件服务端。
            string bundledScript = Path.Combine(_appDir, "server", "bundle.mjs");
            string legacyScript = Path.Combine(_appDir, "server", "index.js");
            string serverScript = File.Exists(bundledScript) ? bundledScript : legacyScript;
            if (!File.Exists(serverScript)) return;

            string nodeExe = ResolveNodeExecutable();
            if (nodeExe == null)
            {
                MessageBox.Show(
                    "未找到 Node.js 运行时，AI 生成、实时数据与授权校验将不可用。\n\n" +
                    "请重新安装完整安装包（安装包应包含 runtime\\node.exe），" +
                    "或先安装 Node.js 后重启本程序。",
                    "鲸动交互平台 - 缺少运行环境",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                return;
            }

            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = nodeExe;
                psi.Arguments = "\"" + serverScript + "\"";
                psi.WorkingDirectory = _appDir;
                psi.CreateNoWindow = true;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.UseShellExecute = false;
                // 桌面端不签发授权：卡密与导出许可统一由官网服务端处理，
                // 避免密钥和后台随安装包落到用户机器上。
                psi.EnvironmentVariables["AETHER_LICENSE_MODE"] = "disabled";
                psi.EnvironmentVariables["AETHER_ALLOW_DEV_LICENSE"] = "0";
                _nodeProcess = Process.Start(psi);
                if (_nodeProcess == null || _nodeProcess.HasExited)
                {
                    MessageBox.Show(
                        "本地服务启动失败，AI 生成与实时数据功能将不可用。\n请查看是否已有其他程序占用 8080 端口。",
                        "鲸动交互平台 - 服务未启动",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "本地服务启动失败：" + ex.Message + "\n\nAI 生成与实时数据功能将不可用。",
                    "鲸动交互平台 - 服务未启动",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
            }
        }

        private static void StartWebServer()
        {
            _port = 3388;
            for (int i = 0; i < 10; i++)
            {
                try
                {
                    _listener = new HttpListener();
                    _listener.Prefixes.Add("http://127.0.0.1:" + _port + "/");
                    _listener.Start();
                    break;
                }
                catch
                {
                    _port = new Random().Next(12000, 39000);
                }
            }

            Thread serverThread = new Thread(RunServer);
            serverThread.IsBackground = true;
            serverThread.Start();
        }

        private static void SetupTrayIcon()
        {
            try
            {
                _trayIcon = new NotifyIcon();
                _trayIcon.Text = "鲸动交互平台 - AETHER (正在运行)";

                string iconPath = Path.Combine(_appDir, "store-package", "src-tauri", "icons", "icon.ico");
                if (File.Exists(iconPath))
                {
                    _trayIcon.Icon = new Icon(iconPath);
                }
                else
                {
                    _trayIcon.Icon = SystemIcons.Application;
                }

                ContextMenu menu = new ContextMenu();
                menu.MenuItems.Add(new MenuItem("打开主界面", delegate { LaunchAppWindow(); }));
                menu.MenuItems.Add(new MenuItem("刷新重载", delegate { LaunchAppWindow(); }));
                menu.MenuItems.Add("-");
                menu.MenuItems.Add(new MenuItem("退出程序", delegate {
                    _running = false;
                    Cleanup();
                    Application.Exit();
                }));

                _trayIcon.ContextMenu = menu;
                _trayIcon.DoubleClick += delegate { LaunchAppWindow(); };
                _trayIcon.Visible = true;
            }
            catch { }
        }

        private static void LaunchAppWindow()
        {
            try
            {
                if (!string.IsNullOrEmpty(_browserPath))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = _browserPath;
                    psi.Arguments = string.Format("--app=\"{0}\" --window-size=1440,900 --user-data-dir=\"{1}\" --no-first-run --no-default-browser-check", _targetUrl, _userDataDir);
                    psi.UseShellExecute = false;

                    _browserProcess = Process.Start(psi);
                }
                else
                {
                    Process.Start(_targetUrl);
                }
            }
            catch { }
        }

        private static void MonitorLifecycle()
        {
            Thread.Sleep(5000);
            while (_running)
            {
                try
                {
                    if (_browserProcess != null && _browserProcess.HasExited)
                    {
                        // 如果浏览器是以退出代码 21 或非零（Edge/Chrome 单实例中转机制）返回，
                        // 说明独立窗口已转交现有浏览器进程托管运行，此时必须保持托盘与本地 Web 服务存活。
                        if (_browserProcess.ExitCode == 0)
                        {
                            Thread.Sleep(1000);
                            if (_browserProcess.HasExited)
                            {
                                _running = false;
                                Cleanup();
                                Application.Exit();
                                break;
                            }
                        }
                    }
                }
                catch { }
                Thread.Sleep(2000);
            }
        }

        private static string FindBrowser()
        {
            string[] candidates = new string[]
            {
                @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                @"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe"),
                @"C:\Program Files\Google\Chrome\Application\chrome.exe",
                @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
            };

            foreach (string path in candidates)
            {
                if (File.Exists(path)) return path;
            }
            return "";
        }

        private static void RunServer()
        {
            while (_running)
            {
                try
                {
                    HttpListenerContext context = _listener.GetContext();
                    ThreadPool.QueueUserWorkItem(ProcessRequest, context);
                }
                catch
                {
                    if (!_running) break;
                }
            }
        }

        private static void ProcessRequest(object state)
        {
            HttpListenerContext context = (HttpListenerContext)state;
            try
            {
                string path = context.Request.Url.AbsolutePath;
                if (path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase) ||
                    path.StartsWith("/admin/", StringComparison.OrdinalIgnoreCase))
                {
                    ProxyToBackend(context);
                    return;
                }

                string rawUrl = path.TrimStart('/');
                if (string.IsNullOrEmpty(rawUrl)) rawUrl = "index.html";

                string filePath = Path.Combine(_distDir, rawUrl.Replace('/', Path.DirectorySeparatorChar));

                if (!File.Exists(filePath))
                {
                    filePath = Path.Combine(_distDir, "index.html");
                }

                if (File.Exists(filePath))
                {
                    byte[] data = File.ReadAllBytes(filePath);
                    context.Response.ContentType = GetMimeType(Path.GetExtension(filePath));
                    context.Response.ContentLength64 = data.Length;
                    context.Response.AddHeader("Cache-Control", "no-cache");
                    context.Response.OutputStream.Write(data, 0, data.Length);
                }
                else
                {
                    context.Response.StatusCode = 404;
                }
            }
            catch { }
            finally
            {
                try { context.Response.OutputStream.Close(); } catch { }
            }
        }

        private static void ProxyToBackend(HttpListenerContext context)
        {
            try
            {
                string backendUrl = "http://127.0.0.1:8080" + context.Request.RawUrl;
                HttpWebRequest targetRequest = (HttpWebRequest)WebRequest.Create(backendUrl);
                targetRequest.Method = context.Request.HttpMethod;
                targetRequest.KeepAlive = false;
                targetRequest.Timeout = 120000;

                foreach (string headerName in context.Request.Headers.AllKeys)
                {
                    if (string.Equals(headerName, "Host", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(headerName, "Connection", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                    if (string.Equals(headerName, "Content-Type", StringComparison.OrdinalIgnoreCase))
                    {
                        targetRequest.ContentType = context.Request.Headers[headerName];
                        continue;
                    }
                    if (string.Equals(headerName, "Content-Length", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                    if (string.Equals(headerName, "User-Agent", StringComparison.OrdinalIgnoreCase))
                    {
                        targetRequest.UserAgent = context.Request.Headers[headerName];
                        continue;
                    }
                    if (string.Equals(headerName, "Accept", StringComparison.OrdinalIgnoreCase))
                    {
                        targetRequest.Accept = context.Request.Headers[headerName];
                        continue;
                    }
                    if (string.Equals(headerName, "Referer", StringComparison.OrdinalIgnoreCase))
                    {
                        targetRequest.Referer = context.Request.Headers[headerName];
                        continue;
                    }
                    try
                    {
                        targetRequest.Headers.Add(headerName, context.Request.Headers[headerName]);
                    }
                    catch { }
                }

                if (context.Request.HasEntityBody)
                {
                    using (Stream reqStream = context.Request.InputStream)
                    using (Stream targetStream = targetRequest.GetRequestStream())
                    {
                        byte[] buffer = new byte[8192];
                        int read;
                        while ((read = reqStream.Read(buffer, 0, buffer.Length)) > 0)
                        {
                            targetStream.Write(buffer, 0, read);
                        }
                    }
                }

                using (HttpWebResponse targetResponse = (HttpWebResponse)targetRequest.GetResponse())
                {
                    context.Response.StatusCode = (int)targetResponse.StatusCode;
                    context.Response.StatusDescription = targetResponse.StatusDescription;
                    context.Response.ContentType = targetResponse.ContentType;

                    foreach (string headerName in targetResponse.Headers.AllKeys)
                    {
                        if (string.Equals(headerName, "Transfer-Encoding", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(headerName, "Content-Length", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(headerName, "Content-Type", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(headerName, "Server", StringComparison.OrdinalIgnoreCase))
                        {
                            continue;
                        }
                        try
                        {
                            context.Response.Headers.Add(headerName, targetResponse.Headers[headerName]);
                        }
                        catch { }
                    }

                    using (Stream respStream = targetResponse.GetResponseStream())
                    {
                        byte[] buffer = new byte[8192];
                        int read;
                        while ((read = respStream.Read(buffer, 0, buffer.Length)) > 0)
                        {
                            context.Response.OutputStream.Write(buffer, 0, read);
                        }
                    }
                }
            }
            catch (WebException wex)
            {
                if (wex.Response != null)
                {
                    using (HttpWebResponse errResp = (HttpWebResponse)wex.Response)
                    {
                        context.Response.StatusCode = (int)errResp.StatusCode;
                        context.Response.ContentType = errResp.ContentType;
                        using (Stream errStream = errResp.GetResponseStream())
                        {
                            byte[] buffer = new byte[8192];
                            int read;
                            while ((read = errStream.Read(buffer, 0, buffer.Length)) > 0)
                            {
                                context.Response.OutputStream.Write(buffer, 0, read);
                            }
                        }
                    }
                }
                else
                {
                    context.Response.StatusCode = 502;
                    byte[] msg = Encoding.UTF8.GetBytes("{\"success\":false,\"error\":\"后端服务未就绪，请稍后重试\"}");
                    context.Response.ContentType = "application/json; charset=utf-8";
                    context.Response.ContentLength64 = msg.Length;
                    context.Response.OutputStream.Write(msg, 0, msg.Length);
                }
            }
            catch (Exception ex)
            {
                context.Response.StatusCode = 500;
                byte[] msg = Encoding.UTF8.GetBytes("{\"success\":false,\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}");
                context.Response.ContentType = "application/json; charset=utf-8";
                context.Response.ContentLength64 = msg.Length;
                context.Response.OutputStream.Write(msg, 0, msg.Length);
            }
        }

        private static string GetMimeType(string ext)
        {
            if (string.IsNullOrEmpty(ext)) return "application/octet-stream";
            switch (ext.ToLower())
            {
                case ".html": case ".htm": return "text/html; charset=utf-8";
                case ".js": case ".mjs": return "application/javascript; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".json": return "application/json; charset=utf-8";
                case ".svg": return "image/svg+xml";
                case ".png": return "image/png";
                case ".jpg": case ".jpeg": return "image/jpeg";
                case ".gif": return "image/gif";
                case ".webp": return "image/webp";
                case ".ico": return "image/x-icon";
                case ".wasm": return "application/wasm";
                case ".mp4": return "video/mp4";
                case ".webm": return "video/webm";
                case ".mp3": return "audio/mpeg";
                case ".wav": return "audio/wav";
                case ".glb": return "model/gltf-binary";
                case ".gltf": return "model/gltf+json";
                default: return "application/octet-stream";
            }
        }

        private static void Cleanup()
        {
            _running = false;
            try
            {
                if (_trayIcon != null)
                {
                    _trayIcon.Visible = false;
                    _trayIcon.Dispose();
                }
            }
            catch { }

            try
            {
                if (_listener != null && _listener.IsListening)
                {
                    _listener.Stop();
                    _listener.Close();
                }
            }
            catch { }

            try
            {
                if (_nodeProcess != null && !_nodeProcess.HasExited)
                {
                    _nodeProcess.Kill();
                }
            }
            catch { }
        }
    }
}
