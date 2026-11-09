/**
 * HTML 导出器
 * 生成可交互的 HTML 网页，支持全景/3D/热点交互
 * 包含完整运行时、工程数据、素材（可选内嵌）
 */

import JSZip from 'jszip';
import runtime3dCode from './runtime3d.js?raw';
import { watermarkService } from './watermark';
import {
  DEFAULT_WATERMARK,
  type HTMLExportOptions,
  type ExportResult,
  type WatermarkConfig,
} from './types';
import { sanitizeExportData } from '../realtime/sanitizeExportData';
import { serializeExportProof } from '../../utils/exportProof';

/** HTML 导出上下文 */
export interface HTMLRenderContext {
  /** 工程数据（将序列化为 JSON 内嵌） */
  projectData: any;
  /** 素材映射：assetId -> Blob（用于内嵌或打包） */
  assets?: Map<string, Blob>;
  /** 运行时代码（可选，不提供则使用 CDN 版本） */
  runtimeCode?: string;
  /** 当前用户ID（用于水印） */
  userId?: string;
  /** 当前工程ID */
  projectId?: string;
}

class HTMLExporter {
  /**
   * 导出 HTML
   * @param options 导出选项
   * @param context 渲染上下文
   */
  async export(
    options: HTMLExportOptions,
    context: HTMLRenderContext
  ): Promise<ExportResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      options.onProgress?.(0.1, '准备导出');

      // ① 生成水印 CSS 和 HTML
      const watermarkConfig = this.getWatermarkConfig(options);
      const watermarkCSS = watermarkService.generateHTMLWatermarkCSS(watermarkConfig);
      const watermarkHTML = watermarkService.generateHTMLWatermarkElement(watermarkConfig);

      // ② 序列化工程数据
      options.onProgress?.(0.3, '处理工程数据');
      const safeProjectData = sanitizeExportData(context.projectData);
      const projectJSON = JSON.stringify(safeProjectData);

      // ③ 处理素材
      options.onProgress?.(0.5, '处理素材');
      let assetsHTML = '';
      let assetsJS = '';

      if (options.includeAssets !== false && context.assets) {
        const assetData = await this.processAssets(context.assets, options.onProgress);
        assetsJS = assetData.js;
      } else {
        warnings.push('素材未内嵌，HTML 文件需要配合素材目录使用');
      }

      // ④ 生成完整 HTML
      options.onProgress?.(0.7, '生成 HTML');
      const title = options.title || context.projectData?.name || '鲸动交互平台工程';
      const html = this.generateHTML({
        title,
        projectJSON,
        assetsJS,
        watermarkCSS,
        watermarkHTML,
        // Keep exported HTML consistent with the ZIP player: autoplay is opt-in
        // because browsers reject audible video when a scene is entered by code.
        autoPlay: options.autoPlay === true,
        loop: options.loop === true,
        fullscreen: options.fullscreen !== false,
        showControls: options.showControls !== false,
        runtimeCode: context.runtimeCode,
        exportProof: options.exportProof,
      });

      // ⑤ 保存文件
      options.onProgress?.(0.9, '保存文件');
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const filename = this.getFilename(options);
      const url = URL.createObjectURL(blob);
      this.triggerDownload(url, filename);

      setTimeout(() => URL.revokeObjectURL(url), 10000);

      options.onProgress?.(1, '导出完成');

      return {
        success: true,
        format: 'html',
        filename,
        size: blob.size,
        blob,
        url,
        duration: Date.now() - startTime,
        warnings,
      };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error('HTML 导出失败:', e);
      return {
        success: false,
        format: 'html',
        filename: options.filename || 'export',
        size: 0,
        duration: Date.now() - startTime,
        warnings,
        error,
      };
    }
  }

  /**
   * 导出为 ZIP 包（HTML + 素材目录）
   * 适合素材较多、不适合内嵌的场景
   */
  async exportAsZip(
    options: HTMLExportOptions,
    context: HTMLRenderContext
  ): Promise<ExportResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      options.onProgress?.(0.1, '准备导出');

      const zip = new JSZip();
      const watermarkConfig = this.getWatermarkConfig(options);
      const watermarkCSS = watermarkService.generateHTMLWatermarkCSS(watermarkConfig);
      const watermarkHTML = watermarkService.generateHTMLWatermarkElement(watermarkConfig);

      // ① 处理素材（保存到 assets/ 目录）
      options.onProgress?.(0.3, '打包素材');
      const assetPathMap = new Map<string, string>();
      if (context.assets) {
        let index = 0;
        const total = context.assets.size;
        for (const [assetId, blob] of context.assets) {
          const ext = this.getExtensionFromMime(blob.type);
          const path = `assets/${assetId}.${ext}`;
          zip.file(path, blob);
          assetPathMap.set(assetId, path);
          index++;
          options.onProgress?.(0.3 + (index / total) * 0.3, `打包素材 ${index}/${total}`);
        }
      }

      // ② 生成 HTML（引用外部素材）
      options.onProgress?.(0.7, '生成 HTML');
      const projectData = sanitizeExportData({
        ...context.projectData,
        _assetPaths: Object.fromEntries(assetPathMap),
      });
      const projectJSON = JSON.stringify(projectData);

      const title = options.title || context.projectData?.name || '鲸动交互平台工程';
      const html = this.generateHTML({
        title,
        projectJSON,
        assetsJS: '',
        watermarkCSS,
        watermarkHTML,
        autoPlay: options.autoPlay === true,
        loop: options.loop === true,
        fullscreen: options.fullscreen !== false,
        showControls: options.showControls !== false,
        runtimeCode: context.runtimeCode,
        useExternalAssets: true,
        exportProof: options.exportProof,
      });

      zip.file('index.html', html);

      // ③ 生成 ZIP
      options.onProgress?.(0.9, '压缩文件');
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const filename = `${options.filename || 'export'}.zip`;
      const url = URL.createObjectURL(blob);
      this.triggerDownload(url, filename);
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      options.onProgress?.(1, '导出完成');

      return {
        success: true,
        format: 'html',
        filename,
        size: blob.size,
        blob,
        url,
        duration: Date.now() - startTime,
        warnings,
      };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        format: 'html',
        filename: options.filename || 'export',
        size: 0,
        duration: Date.now() - startTime,
        warnings,
        error,
      };
    }
  }

  // ==================== 内部方法 ====================

  /**
   * 处理素材，转换为 base64 内嵌
   */
  private async processAssets(
    assets: Map<string, Blob>,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<{ js: string }> {
    const entries: string[] = [];
    let index = 0;
    const total = assets.size;

    for (const [assetId, blob] of assets) {
      const dataURL = await this.blobToDataURL(blob);
      entries.push(`"${assetId}": "${dataURL}"`);
      index++;
      onProgress?.(0.5 + (index / total) * 0.2, `处理素材 ${index}/${total}`);
    }

    return {
      js: `window.__AETHER_ASSETS__ = {${entries.join(',')}};`,
    };
  }

  /**
   * Blob 转 DataURL
   */
  private blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 生成完整 HTML
   */
  private generateHTML(params: {
    title: string;
    projectJSON: string;
    assetsJS: string;
    watermarkCSS: string;
    watermarkHTML: string;
    autoPlay: boolean;
    loop: boolean;
    fullscreen: boolean;
    showControls: boolean;
    runtimeCode?: string;
    useExternalAssets?: boolean;
    exportProof?: import('../../utils/exportProof').ExportProof;
  }): string {
    const {
      title,
      projectJSON,
      assetsJS,
      watermarkCSS,
      watermarkHTML,
      autoPlay,
      loop,
      fullscreen,
      showControls,
      runtimeCode,
      useExternalAssets,
    } = params;

    const runtimeScript = runtimeCode
      ? `<script>${runtimeCode}</script>`
      : `<script>${runtime3dCode}</script>`;
    const proofMeta = params.exportProof
      ? `<meta name="aether-export-proof" content="${this.escapeHTML(serializeExportProof(params.exportProof))}">`
      : '';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  ${proofMeta}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHTML(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #aether-container {
      width: 100%;
      height: 100%;
      position: relative;
    }
    #aether-canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    .aether-controls {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 10px;
      z-index: 100;
      opacity: 0;
      transition: opacity 0.3s;
    }
    body:hover .aether-controls { opacity: 1; }
    .aether-btn {
      padding: 8px 16px;
      background: rgba(0,0,0,0.6);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      backdrop-filter: blur(10px);
    }
    .aether-btn:hover { background: rgba(255,255,255,0.15); }
    .aether-loading {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #fff;
      font-size: 16px;
      z-index: 200;
    }
    ${watermarkCSS}
  </style>
</head>
<body>
  <div id="aether-container">
    <canvas id="aether-canvas"></canvas>
    <div class="aether-loading" id="aether-loading">加载中...</div>
    ${showControls ? `
    <div class="aether-controls">
      <button class="aether-btn" id="aether-play">播放</button>
      <button class="aether-btn" id="aether-pause">暂停</button>
      <button class="aether-btn" id="aether-restart">重新开始</button>
      <button class="aether-btn" id="aether-fullscreen">全屏</button>
    </div>` : ''}
    ${watermarkHTML}
  </div>

  <script>
    // 工程数据（safeScriptJSON 已将 </script 转义为 <\/script，防止注入）
    window.__AETHER_PROJECT__ = ${this.escapeScriptJSON(projectJSON)};
    // 素材数据（内嵌）
    ${assetsJS}
    // 配置
    window.__AETHER_CONFIG__ = {
      autoPlay: ${autoPlay},
      loop: ${loop},
      fullscreen: ${fullscreen},
      showControls: ${showControls},
      useExternalAssets: ${useExternalAssets || false},
    };
  </script>
  ${runtimeScript}
  <script>
    // 初始化运行时
    if (window.AetherRuntime) {
      const runtime = new window.AetherRuntime({
        container: document.getElementById('aether-container'),
        canvas: document.getElementById('aether-canvas'),
        project: window.__AETHER_PROJECT__,
        assets: window.__AETHER_ASSETS__ || {},
        config: window.__AETHER_CONFIG__,
      });
      runtime.init().then(() => {
        document.getElementById('aether-loading')?.remove();
      }).catch((err) => {
        document.getElementById('aether-loading').textContent = '加载失败: ' + err.message;
      });

      // 控制按钮
      document.getElementById('aether-play')?.addEventListener('click', () => runtime.play());
      document.getElementById('aether-pause')?.addEventListener('click', () => runtime.pause());
      document.getElementById('aether-restart')?.addEventListener('click', () => runtime.restart());
      document.getElementById('aether-fullscreen')?.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      });
    } else {
      document.getElementById('aether-loading').textContent = '运行时加载失败，请检查网络连接';
    }
  </script>
</body>
</html>`;
  }

  /**
   * 获取水印配置
   */
  private getWatermarkConfig(options: HTMLExportOptions): WatermarkConfig {
    return { ...DEFAULT_WATERMARK };
  }

  /**
   * 从 MIME 类型获取扩展名
   */
  private getExtensionFromMime(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'model/gltf-binary': 'glb',
    };
    return map[mimeType] || 'bin';
  }

  /**
   * HTML 转义
   */
  private escapeHTML(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * 将序列化后的 JSON 安全嵌入 <script> 标签：
   * 转义 </script 闭合序列，防止用户文本（含 </script>）提前闭合脚本造成注入/破包。
   * JSON.stringify 输出中的 < 只会出现在字符串字面量内，统一替换为 \u003c 是安全的
   * （解析后仍是原字符，但不会闭合 script 标签）。
   */
  private escapeScriptJSON(projectJSON: string): string {
    return projectJSON.replace(/</g, '\\u003c');
  }

  /**
   * 获取文件名
   */
  private getFilename(options: HTMLExportOptions): string {
    const base = options.filename || `export_${Date.now()}`;
    return `${base}.html`;
  }

  /**
   * 触发浏览器下载
   */
  private triggerDownload(url: string, filename: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/** 单例导出 */
export const htmlExporter = new HTMLExporter();
