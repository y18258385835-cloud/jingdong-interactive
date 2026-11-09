/**
 * 导出水印（ZIP / 单文件 HTML / 独立播放器共用）。
 *
 * 水印由宿主页面直接渲染，不依赖播放器运行时，因此任何导出形态都生效。
 * 是否开启由调用方根据授权档位决定（`export_no_watermark`）。
 * 
 * 内置防篡改与自毁看门狗：
 * 运行时若在无合法授权情况下通过 DOM 删除、隐藏或篡改水印，
 * 将立即阻断底层 Canvas 渲染管线，防止未授权商用去水印。
 */
export interface ExportWatermarkOptions {
  enabled: boolean;
  text?: string;
  opacity?: number;
}

export const DEFAULT_EXPORT_WATERMARK_TEXT = '鲸动交互平台 · 未授权导出';

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export function buildExportWatermarkMarkup(config?: ExportWatermarkOptions): string {
  if (!config?.enabled) return '';
  const text = escapeHtml(config.text || DEFAULT_EXPORT_WATERMARK_TEXT);
  const opacity = Math.min(1, Math.max(0.2, config.opacity ?? 0.72));

  // 混淆的防篡改看门狗脚本，监听水印节点的生命周期与可见性
  const antiTamperScript = `
<script>
(function(){
  try {
    var _tid = 'aether-watermark';
    function _halt() {
      try {
        window.__AETHER_TAMPER_HALTED__ = true;
        // 终止所有动画帧
        var id = window.requestAnimationFrame(function(){});
        while (id--) { window.cancelAnimationFrame(id); }
        // 冻结所有 Canvas 渲染
        var cvs = document.querySelectorAll('canvas');
        cvs.forEach(function(c) {
          try {
            var ctx = c.getContext('2d');
            if (ctx) {
              ctx.save();
              ctx.fillStyle = '#060a12';
              ctx.fillRect(0, 0, c.width, c.height);
              ctx.fillStyle = '#ff4d4f';
              ctx.font = 'bold 18px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('⚠️ 水印节点已被非法修改，渲染引擎已终止', c.width / 2, c.height / 2);
              ctx.restore();
            }
          } catch(e) {}
        });
        // 弹出阻断覆盖层
        if (!document.getElementById('aether-tamper-guard')) {
          var div = document.createElement('div');
          div.id = 'aether-tamper-guard';
          div.style.cssText = 'position:fixed;inset:0;background:rgba(6,10,18,0.96);z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;padding:24px;text-align:center;';
          div.innerHTML = '<div style="font-size:48px;margin-bottom:16px;">🛑</div><h2 style="font-size:20px;color:#ff4d4f;margin-bottom:8px;">运行保护拦截：检测到水印节点被非法移除或篡改</h2><p style="color:#94a3b8;font-size:14px;max-width:480px;line-height:1.6;margin-bottom:20px;">本工程为免费试用导出版本。商业使用或无水印分发请前往官网获取正版商用授权。</p><a href="https://jd-hub.top" target="_blank" style="padding:10px 24px;background:#00d2ff;color:#060a12;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">获取商用授权码 ↗</a>';
          document.body.appendChild(div);
        }
      } catch(e) {}
    }

    function _verify() {
      var el = document.getElementById(_tid);
      if (!el) { _halt(); return false; }
      var style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') < 0.1) {
        _halt(); return false;
      }
      var rect = el.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10 || rect.bottom < 0 || rect.right < 0) {
        _halt(); return false;
      }
      return true;
    }

    if (window.MutationObserver) {
      var observer = new MutationObserver(function() {
        if (!_verify()) observer.disconnect();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    }
    setInterval(_verify, 600);
  } catch (err) {}
})();
</script>`;

  return `<style>#aether-watermark{position:fixed;right:16px;bottom:16px;z-index:2147483000;pointer-events:none;font:600 12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;letter-spacing:.04em;color:rgba(255,255,255,${opacity});background:rgba(0,0,0,.32);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:5px 11px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);white-space:nowrap}</style><div id="aether-watermark" data-aether-watermark="1">${text}</div>${antiTamperScript}`;
}
