import React, { useEffect, useMemo, useRef } from 'react';
import type { HoverEffect } from '../types';
import { buildCustomCodeSrcDoc, inspectCustomCodePlugin, type CustomCodeTextStyle } from '../utils/customCode';
import { formatRuntimeDiagnosticMessage, parseRuntimeDiagnostic, type CustomCodeRuntimeDiagnostic } from '../utils/customCodeRuntimeDiagnostics';

export type CustomCodeFrameBounds = { x: number; y: number; width: number; height: number; viewportWidth: number; viewportHeight: number };
interface TransparentCustomCodeFrameProps {
  html: string; css: string; js?: string; interactive: boolean; hoverEffect?: HoverEffect; hoverActive?: boolean; hoverColor?: string;
  typography?: CustomCodeTextStyle; className?: string; surfaceBackground?: string; onBounds?: (bounds: CustomCodeFrameBounds) => void;
  onRuntimeError?: (message: string) => void; onRuntimeDiagnostic?: (diagnostic: CustomCodeRuntimeDiagnostic) => void;
  textEditing?: boolean; focusTextKey?: string; textOverrides?: Record<string, string>; onContentChange?: (html: string, textKey?: string, value?: string) => void;
  onTextChange?: (textKey: string, value: string) => void; onRequestTextEditing?: (textKey?: string) => void;
  textHotspots?: any[]; onTextContextMenu?: (selection: any) => void; onTextHotspotTrigger?: (hotspotId: string) => void;
  props?: Record<string, any>;
  /** 预览卡片固定尺寸时，把超出画布的内容等比缩小，避免被裁切。 */
  fitContent?: boolean;
}

const HOST_MESSAGE_SOURCE = 'aether-custom-code-host';
const FRAME_MESSAGE_SOURCE = 'aether-custom-code';

/**
 * 自定义代码组件渲染器。
 *
 * 历史实现直接把用户代码用 `new Function` 放在编辑器同源页面里执行，
 * 打开一个别人分享的工程就能读取 localStorage 中的授权令牌与用户 API Key。
 * 现在改为 `sandbox="allow-scripts"`（不带 allow-same-origin）的 iframe：
 * 代码运行在独立的 opaque origin 中，只能通过 postMessage 与编辑器通信。
 */
export const TransparentCustomCodeFrame: React.FC<TransparentCustomCodeFrameProps> = ({
  html, css, js = '', interactive, hoverEffect = 'none', hoverActive = false, hoverColor = '#38bdf8', typography,
  className, onBounds, onRuntimeError, onRuntimeDiagnostic, textEditing = false, focusTextKey, props,
  onContentChange, onRequestTextEditing, fitContent = false,
}) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const instanceId = useMemo(() => `ccf_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`, []);
  const callbacks = useRef({ onBounds, onRuntimeError, onRuntimeDiagnostic, onContentChange, onRequestTextEditing });
  callbacks.current = { onBounds, onRuntimeError, onRuntimeDiagnostic, onContentChange, onRequestTextEditing };
  const propsRef = useRef<Record<string, any>>(props || {});
  propsRef.current = props || {};

  const plugin = useMemo(() => {
    const diagnostics = inspectCustomCodePlugin({ html, css, js });
    return diagnostics.errors.length
      ? { html: '<div class="aether-custom-code-missing">组件代码未通过安全检查</div>', css: '', js: '', diagnostics }
      : { html, css, js, diagnostics };
  }, [css, html, js]);

  const typographyKey = typography ? JSON.stringify(typography) : '';
  const srcDoc = useMemo(
    () => buildCustomCodeSrcDoc(plugin, instanceId, 'transparent', textEditing, typography, focusTextKey, fitContent),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plugin, instanceId, textEditing, typographyKey, focusTextKey, fitContent],
  );

  const postProps = () => {
    const target = frameRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(
      { source: HOST_MESSAGE_SOURCE, instanceId, type: 'props', props: propsRef.current || {} },
      '*',
    );
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as Record<string, any> | null;
      if (!data || data.source !== FRAME_MESSAGE_SOURCE || data.instanceId !== instanceId) return;
      switch (data.type) {
        case 'ready':
          postProps();
          frameRef.current?.contentWindow?.postMessage({ source: HOST_MESSAGE_SOURCE, instanceId, type: 'measure' }, '*');
          break;
        case 'props-applied':
          break;
        case 'bounds': {
          const viewportWidth = Number(data.viewportWidth) || 0;
          const viewportHeight = Number(data.viewportHeight) || 0;
          if (viewportWidth <= 0 || viewportHeight <= 0) break;
          callbacks.current.onBounds?.({
            x: Number(data.x) || 0,
            y: Number(data.y) || 0,
            width: Number(data.width) || 0,
            height: Number(data.height) || 0,
            viewportWidth,
            viewportHeight,
          });
          break;
        }
        case 'content':
          if (typeof data.html === 'string') {
            callbacks.current.onContentChange?.(
              data.html,
              typeof data.textKey === 'string' ? data.textKey : undefined,
              typeof data.value === 'string' ? data.value : undefined,
            );
          }
          break;
        case 'text':
          break;
        case 'diagnostic': {
          const diagnostic = parseRuntimeDiagnostic(
            { message: data.message, stack: data.stack },
            {
              category: data.category === 'console' ? 'console' : 'runtime-error',
              blocking: false,
              level: 'warning',
              line: data.line,
              column: data.column,
            },
          );
          callbacks.current.onRuntimeDiagnostic?.(diagnostic);
          break;
        }
        case 'error':
        case 'unhandledrejection': {
          const diagnostic = parseRuntimeDiagnostic(
            data.type === 'unhandledrejection' ? { message: data.reason, stack: data.stack } : { message: data.message, stack: data.stack },
            {
              category: data.type === 'unhandledrejection' ? 'unhandled-rejection' : 'runtime-error',
              blocking: true,
              level: 'error',
              line: data.line,
              column: data.column,
            },
          );
          callbacks.current.onRuntimeDiagnostic?.(diagnostic);
          callbacks.current.onRuntimeError?.(formatRuntimeDiagnosticMessage(diagnostic));
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [instanceId]);

  // 控件属性（尺寸/辉光/配色/开关/速度）实时下发，避免重建 iframe。
  useEffect(() => {
    postProps();
  }, [props]);

  useEffect(() => {
    if (!plugin.diagnostics?.errors.length) return;
    const first = plugin.diagnostics.errors[0];
    const diagnostic = parseRuntimeDiagnostic(
      { message: first.message, line: first.line, column: first.column },
      { category: 'runtime-error', blocking: true, level: 'error' },
    );
    callbacks.current.onRuntimeDiagnostic?.(diagnostic);
    callbacks.current.onRuntimeError?.(formatRuntimeDiagnosticMessage(diagnostic));
  }, [plugin.diagnostics]);

  const effectStyle = hoverActive
    ? hoverEffect === 'brighten'
      ? { filter: 'brightness(1.16) saturate(1.06)' }
      : hoverEffect === 'glow'
        ? { filter: `drop-shadow(0 0 7px ${hoverColor}) drop-shadow(0 0 18px ${hoverColor})` }
        : hoverEffect === 'outline'
          ? { filter: `drop-shadow(-1px 0 0 ${hoverColor}) drop-shadow(1px 0 0 ${hoverColor}) drop-shadow(0 -1px 0 ${hoverColor}) drop-shadow(0 1px 0 ${hoverColor})` }
          : undefined
    : undefined;

  return (
    <div
      className={className}
      data-aether-effect={hoverEffect}
      data-aether-effect-active={hoverActive ? 'true' : 'false'}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        border: 0,
        outline: 0,
        boxShadow: 'none',
        background: 'transparent',
        colorScheme: 'normal',
        pointerEvents: interactive || textEditing ? 'auto' : 'none',
        ['--aether-effect-color' as string]: hoverColor,
        ...effectStyle,
      }}
      onDoubleClick={(event) => {
        if (!textEditing && callbacks.current.onRequestTextEditing) {
          event.preventDefault();
          callbacks.current.onRequestTextEditing();
        }
      }}
    >
      <iframe
        ref={frameRef}
        title="自定义代码组件安全沙箱"
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        srcDoc={srcDoc}
        onLoad={postProps}
        // 应用根节点是 color-scheme: dark。iframe 会继承该值，Chromium 会把
        // 透明文档的沙箱画布合成成不透明白底。显式 normal 才能保留透明背景。
        style={{ width: '100%', height: '100%', border: 0, display: 'block', background: 'transparent', outline: 0, colorScheme: 'normal', pointerEvents: textEditing ? 'auto' : 'inherit' }}
      />
    </div>
  );
};

export default TransparentCustomCodeFrame;
