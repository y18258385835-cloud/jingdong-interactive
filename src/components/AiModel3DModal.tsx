import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LLMApiConfigPanel, loadLLMConfig, saveLLMConfig, type LLMApiConfig } from './LLMApiConfigPanel';
import { getChatEndpoint, getProvider } from '../utils/llmProviders';
import { Layers, Upload, X, Sparkles, Settings, ChevronDown, ChevronUp, Trash2, Loader2, Check, Box, Zap, Atom, Eye, EyeOff, Code2 } from 'lucide-react';
import { dbManager } from '../utils/db';
import { SceneElement } from '../types';
import { ErrorNoticePanel } from './ErrorRecovery';
import { apiUrl } from '../core/api/url';

// ============================================================
// 类型定义
// ============================================================
interface ApiConfig {
  provider: 'volcengine' | 'tripo' | 'meshy' | 'custom';
  apiKey: string;
  endpoint: string;
  model: string;
  proxyUrl: string;
}

interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
  base64: string;
}

interface AiModel3DModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddModel3D: (element: SceneElement, asset?: { key: string; blob: Blob; name: string }) => void;
  sceneDuration: number;
  embedded?: boolean;
}

const DEFAULT_CONFIG: ApiConfig = {
  provider: 'volcengine',
  apiKey: '',
  endpoint: '',
  model: '',
  proxyUrl: '', // 空字符串 = 走 Vite dev server 内置代理（相对路径）
};

const PROVIDER_LABELS: Record<string, string> = {
  volcengine: '火山引擎 Seed3D',
  tripo: 'Tripo3D',
  meshy: 'Meshy AI',
  custom: '自定义端点',
};

const STORAGE_KEY = 'aether_3d_api_config';

// ============================================================
// 工具函数
// ============================================================
const ACCEPTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_IMAGE_DIMENSION = 2048;
const KEEP_PNG_MAX_BYTES = 4 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function prepareImageForModel(file: File): Promise<string> {
  const original = await fileToBase64(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = original;
  });

  const keepOriginalPng = file.type === 'image/png' &&
    file.size <= KEEP_PNG_MAX_BYTES &&
    image.naturalWidth <= MAX_IMAGE_DIMENSION &&
    image.naturalHeight <= MAX_IMAGE_DIMENSION;
  if (keepOriginalPng) return original;

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) return original;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.88);
}

function loadConfig(): ApiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      // 自动迁移：旧版 localhost:8080 独立代理 → 新版 Vite 内置代理（空字符串）
      if (parsed.proxyUrl === 'http://localhost:8080' || parsed.proxyUrl === 'http://127.0.0.1:8080') {
        parsed.proxyUrl = '';
        saveConfig(parsed);
      }
      return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_CONFIG;
}

function saveConfig(config: ApiConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch { /* ignore */ }
}

// ============================================================
// 组件
// ============================================================
export const AiModel3DModal: React.FC<AiModel3DModalProps> = ({
  isOpen,
  onClose,
  onAddModel3D,
  sceneDuration,
  embedded = false,
}) => {
  const [config, setConfig] = useState<ApiConfig>(loadConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showModeOptions, setShowModeOptions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [proxyStatus, setProxyStatus] = useState<'checking' | 'ok' | 'fail'>('checking');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [genMode, setGenMode] = useState<'seed3d' | 'img2threejs'>('seed3d');
  const [llmConfig, setLlmConfig] = useState<LLMApiConfig>(loadLLMConfig);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<UploadedImage[]>([]);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // 清理预览 URL
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // 弹窗关闭时重置状态
  useEffect(() => {
    if (!isOpen) {
      setIsGenerating(false);
      setProgress(0);
      setStatusText('');
      setError('');
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
  }, [isOpen]);

  // 弹窗打开时自动检测代理状态
  useEffect(() => {
    if (!isOpen) return;
    setProxyStatus('checking');
    const healthUrl = config.proxyUrl ? `${config.proxyUrl}/api/health` : apiUrl('/api/health');
    fetch(healthUrl, { signal: AbortSignal.timeout(3000) })
      .then((r) => r.ok ? setProxyStatus('ok') : setProxyStatus('fail'))
      .catch(() => setProxyStatus('fail'));
  }, [isOpen, config.proxyUrl]);

  useEffect(() => {
    if (!isOpen || isGenerating) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isGenerating, onClose]);

  // ============================================================
  // 图片上传处理（Hook 必须在所有条件 return 之前）
  // ============================================================
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const selectedFiles = Array.from(files);
    const fileArray = selectedFiles.filter((f) => ACCEPTED_IMAGE_TYPES.has(f.type));
    if (fileArray.length === 0) {
      setError('仅支持 PNG、JPG/JPEG 或 WebP 图片');
      return;
    }
    setError(fileArray.length < selectedFiles.length
      ? '已忽略不支持的文件格式，仅接受 PNG、JPG/JPEG 或 WebP'
      : '');

    const newImages: UploadedImage[] = [];
    try {
      for (const file of fileArray) {
        const base64 = await prepareImageForModel(file);
        newImages.push({
          id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          file,
          previewUrl: URL.createObjectURL(file),
          base64,
        });
      }
    } catch {
      newImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      setError('图片读取失败，请选择有效的 PNG、JPG/JPEG 或 WebP 文件');
      return;
    }
    setImages((prev) => [...prev, ...newImages].slice(0, 5)); // 最多5张
  }, []);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = '';
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  // ============================================================
  // 生成 3D 模型
  // ============================================================
  const handleGenerate = async () => {
    if (genMode === 'seed3d' && (config.provider === 'meshy' || config.provider === 'custom')) {
      setError(`${PROVIDER_LABELS[config.provider]}暂未接入，请选择火山引擎 Seed3D 或 Tripo3D`);
      return;
    }
    if (images.length === 0) {
      setError('请至少上传一张图片');
      return;
    }
    if (genMode === 'img2threejs' && !llmConfig.apiKey) { setError('请先填写视觉模型 API Key'); setShowSettings(true); return; }
    if (genMode === 'seed3d' && !config.apiKey) { setError('请先在设置中填写 API Key'); setShowSettings(true); return; }

    setError('');
    setIsGenerating(true);
    setProgress(5);
    setStatusText('正在提交生成任务...');
    saveConfig(config);

    try {
      // img2threejs 模式：AI 生成 Three.js 过程化代码（天然有部件层级，爆炸/分层效果更好）
      if (genMode === 'img2threejs') {
        setProgress(10);
        setStatusText('AI 正在分析图片结构...');

        const provider = getProvider(llmConfig.providerId);
        const endpoint = getChatEndpoint(llmConfig.providerId, llmConfig.customEndpoint);
        const model = llmConfig.model?.trim() || provider?.visionModels[0] || provider?.defaultModel || '';
        if (!endpoint || !model) {
          throw new Error('请先在 API 配置中填写视觉模型端点和模型名称');
        }

        const codeRes = await fetch(`${config.proxyUrl || apiUrl('')}/api/3d/img2threejs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: llmConfig.apiKey, endpoint, model, images: images.map((i) => i.base64) }),
          signal: AbortSignal.timeout(180000),
        });

        let codeData: any = {};
        try {
          codeData = await codeRes.json();
        } catch {
          throw new Error(`代码生成接口返回了无效响应 (HTTP ${codeRes.status})`);
        }
        if (!codeData.success || !codeData.code) {
          throw new Error(codeData.error || `代码生成失败 (HTTP ${codeRes.status})`);
        }

        setProgress(80);
        setStatusText('代码生成完成，正在创建模型...');

        // 创建 model-3d 元素（代码模式，不需要 GLB 文件）
        const newElement: SceneElement = {
          id: 'el_model3d_' + Date.now(),
          type: 'model-3d',
          refId: '',
          sourceName: 'AI 过程化 3D 模型 (img2threejs)',
          x: 20,
          y: 15,
          w: 60,
          h: 65,
          rot: 0,
          zIndex: 10,
          opacity: 100,
          startTime: 0,
          duration: sceneDuration,
          modelAutoRotate: true,
          modelAutoRotateSpeed: 1,
          ai3dLayers: 0,
          ai3dExplode: 0,
          ai3dPhysics: false,
          ai3dLoopEnabled: true,
          ai3dExplodeSpeed: 1,
          ai3dExplodeSpin: 0.5,
          ai3dCollisionBounce: 0.5,
          ai3dCollisionSpeed: 1,
          ai3dPreviewControls: {},
          ai3dExportControls: {},
          ai3dControlVariant: 'glass',
          ai3dCode: codeData.code,
          ai3dCodeSource: 'img2threejs',
          ai3dTexture: images[0]?.base64, // 第一张图片作为纹理，传递给 createModel(textureData)
        };

        setProgress(100);
        setStatusText('完成！已添加到场景');
        setTimeout(() => {
          onAddModel3D(newElement);
          onClose();
        }, 800);
        return;
      }

      // 1. 创建任务
      const createRes = await fetch(`${config.proxyUrl || apiUrl('')}/api/3d/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: config.provider,
          endpoint: config.endpoint,
          model: config.model,
          apiKey: config.apiKey,
          images: images.map((i) => i.base64),
        }),
      });

      const createData = await createRes.json();
      if (!createData.success || !createData.taskId) {
        throw new Error(createData.error || createData.details?.message || '任务创建失败');
      }

      const taskId = createData.taskId;
      setProgress(15);
      setStatusText('AI 正在生成 3D 模型，请稍候...');

      // 2. 轮询任务状态
      await new Promise<void>((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 120; // 最多轮询 120 次（约 10 分钟）

        pollTimerRef.current = setInterval(async () => {
          attempts++;
          if (attempts > maxAttempts) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            reject(new Error('生成超时，请稍后重试'));
            return;
          }

          try {
            const taskRes = await fetch(`${config.proxyUrl || apiUrl('')}/api/3d/task`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                provider: config.provider,
                endpoint: config.endpoint,
                apiKey: config.apiKey,
                taskId,
              }),
            });
            const taskData = await taskRes.json();

            if (taskData.isCompleted && taskData.outputUrl) {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              setProgress(85);
              setStatusText('生成完成，正在下载模型...');
              // 把 modelUrl 存到全局，后续下载
              (window as any).__aether3dModelUrl = taskData.outputUrl;
              resolve();
            } else if (taskData.isFailed || taskData.error) {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              reject(new Error(taskData.error || taskData.raw?.error || '生成失败'));
            } else {
              // 更新进度
              const p = Math.min(80, 15 + attempts * 0.5);
              setProgress(p);
            }
          } catch (e) {
            // 网络错误，继续轮询
          }
        }, 3000);
      });

      // 3. 下载模型文件
      const modelUrl = (window as any).__aether3dModelUrl;
      if (!modelUrl) throw new Error('模型下载地址无效');

      const downloadRes = await fetch(`${config.proxyUrl || apiUrl('')}/api/3d/download?url=${encodeURIComponent(modelUrl)}`);
      if (!downloadRes.ok) throw new Error('模型下载失败');
      console.log('[AI3D] 下载响应:', { ok: downloadRes.ok, status: downloadRes.status, contentType: downloadRes.headers.get('content-type') });
      const modelBlob = await downloadRes.blob();
      console.log('[AI3D] 模型Blob:', { size: modelBlob.size, type: modelBlob.type });
      // 4. 存入 IndexedDB + 内存缓存（双重保障，确保 CanvasViewport 能立即拿到 assetUrl）
      const refKey = 'res_model3d_' + Date.now();
      await dbManager.put(refKey, modelBlob);

      // 5. 创建 model-3d 元素
      const newElement: SceneElement = {
        id: 'el_model3d_' + Date.now(),
        type: 'model-3d',
        refId: refKey,
        sourceName: `AI 生成 3D 模型 (${PROVIDER_LABELS[config.provider]})`,
        x: 20,
        y: 15,
        w: 60,
        h: 65,
        rot: 0,
        zIndex: 10,
        opacity: 100,
        startTime: 0,
        duration: sceneDuration,
        modelAutoRotate: true,
        modelAutoRotateSpeed: 1,
        // AI 3D 控制参数（三个按钮效果用）
        ai3dLayers: 0,      // 分层程度 0-1
        ai3dExplode: 0,     // 爆炸程度 0-1
        ai3dPhysics: false, // 物理碰撞开关
        ai3dLoopEnabled: true,
        ai3dExplodeSpeed: 1,
        ai3dExplodeSpin: 0.5,
        ai3dCollisionBounce: 0.5,
        ai3dCollisionSpeed: 1,
        ai3dPreviewControls: {},
        ai3dExportControls: {},
        ai3dControlVariant: 'glass',
      };

      setProgress(100);
      setStatusText('完成！已添加到场景');

      // 短暂延迟后关闭
      setTimeout(() => {
        onAddModel3D(newElement, {
          key: refKey,
          blob: modelBlob,
          name: `AI 生成 3D 模型 (${PROVIDER_LABELS[config.provider]})`,
        });
        onClose();
      }, 800);
    } catch (err) {
      console.error('[AI 3D 生成] 错误:', err);
      setError(err instanceof Error ? err.message : '生成失败，请重试');
      setIsGenerating(false);
      setProgress(0);
      setStatusText('');
    }
  };

  // ============================================================
  // 渲染
  // ============================================================
  return (
    <div className={embedded ? 'flex h-full min-h-0 w-full items-center justify-center' : 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md'} role="presentation">
      <div className={embedded ? 'flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden text-slate-200' : 'w-full max-w-2xl overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#141622] text-slate-200 shadow-2xl animate-in zoom-in-95'} role="dialog" aria-modal="true" aria-label="AI 3D 生成">
        <input
          type="file"
          ref={fileInputRef}
          aria-label="上传用于生成 3D 模型的图片"
          className="hidden"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={handleFileChange}
        />

        {/* Header */}
        {!embedded && <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-cyan-950/40 to-purple-950/30">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-cyan-500/30 to-purple-500/30 rounded-lg text-cyan-300">
              <Box size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                AI 图片转 3D 模型
                <span className="text-[9px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded font-mono">AI</span>
              </h2>
              <p className="text-[11px] text-slate-400">上传产品图，AI 自动生成带 PBR 材质的 3D 模型，支持分层/爆炸/碰撞效果</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
            aria-label="关闭 AI 3D 生成窗口"
          >
            <X size={18} />
          </button>
        </div>}

        {/* Body */}
        <div className={`${embedded ? 'min-h-0 flex-1' : 'max-h-[70vh]'} overflow-y-auto p-4 sm:p-5 space-y-4 fluent-custom-scroll`}>
          <style>{`
            .fluent-custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
            .fluent-custom-scroll::-webkit-scrollbar-track { background: transparent; }
            .fluent-custom-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); border-radius: 9999px; }
            .fluent-custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.25); }
          `}</style>

          {/* 生成模式分段选择器 (Fluent Segmented Control) */}
          {!isGenerating && (
            <div className="space-y-2.5">
              <div className="p-1 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setGenMode('seed3d')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    genMode === 'seed3d'
                      ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-200 border border-cyan-400/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                  }`}
                >
                  <Box size={14} className={genMode === 'seed3d' ? 'text-cyan-400' : 'text-slate-400'} />
                  <span>3D 模型资产 (Seed3D GLB)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGenMode('img2threejs')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    genMode === 'img2threejs'
                      ? 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-purple-200 border border-violet-400/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                  }`}
                >
                  <Code2 size={14} className={genMode === 'img2threejs' ? 'text-violet-400' : 'text-slate-400'} />
                  <span>过程化代码 (Three.js 结构分层)</span>
                </button>
              </div>

              {/* 模式特性说明条 */}
              {genMode === 'seed3d' ? (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-cyan-500/10 border border-cyan-400/20 text-xs text-cyan-200 leading-relaxed">
                  <span className="text-sm leading-none mt-0.5">💡</span>
                  <div className="min-w-0 flex-1 text-[11px]">
                    <span className="font-semibold text-white">当前为「Seed3D GLB」资产模式</span>，快速生成可直接导入三维场景的标准 3D 模型资产。
                    <br />
                    如需按产品结构独立分层、实现爆炸拆解与零件物理碰撞动效，请点击上方切换至 <span className="font-semibold text-purple-300">「过程化代码」</span> 模式（支持 13+ 视觉大模型）。
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-purple-500/10 border border-purple-400/20 text-xs text-purple-200 leading-relaxed">
                  <span className="text-sm leading-none mt-0.5">✨</span>
                  <div className="min-w-0 flex-1 text-[11px]">
                    <span className="font-semibold text-white">当前为「过程化代码」模式</span>，AI 深度解析参考图并生成参数化 Three.js 代码，模型部件天然独立分层，爆炸拆解与物理互动更加自然精细。
                  </div>
                </div>
              )}
            </div>
          )}

          {/* API 设置（可折叠） */}
          <div className={`${embedded ? 'border-t border-white/[.07] pt-2' : 'border border-white/10 rounded-xl'} overflow-hidden`}>
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`w-full flex items-center justify-between text-left transition-colors ${embedded ? 'py-2 text-slate-400 hover:text-slate-200' : 'px-4 py-2.5 bg-white/5 hover:bg-white/10'}`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Settings size={13} className="text-cyan-400" />
                API 配置与连接
                {((genMode === 'seed3d' && config.apiKey) || (genMode === 'img2threejs' && llmConfig.apiKey)) && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                    <Check size={10} /> 凭据已就绪
                  </span>
                )}
              </div>
              {showSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showSettings && (
              genMode === 'img2threejs' ? (
                <div className="p-4 border-t border-white/10">
                  <LLMApiConfigPanel
                    value={llmConfig}
                    onChange={(c) => { setLlmConfig(c); saveLLMConfig(c); }}
                    visionOnly={true}
                  />
                </div>
              ) : (
                <div className="p-4 space-y-3.5 border-t border-white/10 bg-white/[0.015]">
                  {/* 主配置：提供商 + API Key */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">API 提供商</label>
                      <select
                        value={config.provider}
                        onChange={(e) => setConfig({ ...config, provider: e.target.value as ApiConfig['provider'] })}
                        className="w-full bg-[#1a1d2e] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                      >
                        <option value="volcengine">火山引擎 Seed3D</option>
                        <option value="tripo">Tripo3D</option>
                        <option value="meshy" disabled>Meshy AI（暂未开放）</option>
                        <option value="custom" disabled>自定义端点（暂未开放）</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">API Key</label>
                      <div className="relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={config.apiKey}
                          onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                          placeholder="请输入 API Key"
                          className="w-full bg-[#1a1d2e] border border-white/10 rounded-lg pl-3 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                          title={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                          aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                        >
                          {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 代理状态自动检测 */}
                  <div className="flex items-center gap-2 text-[11px]">
                    {proxyStatus === 'checking' && (
                      <span className="text-amber-400 flex items-center gap-1.5">
                        <Loader2 size={12} className="animate-spin" /> 检测本地连接服务...
                      </span>
                    )}
                    {proxyStatus === 'ok' && (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <Check size={12} /> 本地连接服务已就绪（安全通信中继）
                      </span>
                    )}
                    {proxyStatus === 'fail' && (
                      <span className="text-rose-400 flex items-center gap-1.5">
                        <X size={12} /> 本地安全中继未就绪，请检查服务连接状态
                      </span>
                    )}
                  </div>

                  {/* 高级设置折叠 */}
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-300 transition-colors py-1"
                  >
                    <span className="flex items-center gap-1.5">
                      <Settings size={11} /> 高级设置（自定义端点 / 代理地址）
                    </span>
                    {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {showAdvanced && (
                    <div className="space-y-3 pt-1 border-t border-white/5">
                      {/* 本地代理地址 */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] text-slate-400">中继代理地址（留空使用系统默认安全中继）</label>
                          <button
                            type="button"
                            onClick={() => setConfig({ ...config, proxyUrl: '' })}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
                          >
                            恢复默认
                          </button>
                        </div>
                        <input
                          type="text"
                          value={config.proxyUrl}
                          onChange={(e) => setConfig({ ...config, proxyUrl: e.target.value })}
                          placeholder="留空使用系统默认安全中继"
                          className="w-full bg-[#1a1d2e] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono"
                        />
                      </div>
                      {/* 自定义端点 + 模型名 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">自定义端点（可选）</label>
                          <input
                            type="text"
                            value={config.endpoint}
                            onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
                            placeholder="留空使用默认"
                            className="w-full bg-[#1a1d2e] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">自定义模型名（可选）</label>
                          <input
                            type="text"
                            value={config.model}
                            onChange={(e) => setConfig({ ...config, model: e.target.value })}
                            placeholder="留空使用默认"
                            className="w-full bg-[#1a1d2e] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400/80 leading-relaxed">
                    API 凭据安全隔离存储于本地设备，不会上传至第三方服务器。所有网络请求经由本地安全中继，保证端到端通信隐私与数据安全。
                  </p>
                </div>
              )
            )}
          </div>

          {/* 图片上传区域 */}
          {!isGenerating && (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
                }}
                className={`border border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                    : 'border-white/15 hover:border-cyan-400/50 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <div className="mx-auto w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-cyan-300 mb-2.5">
                  <Upload size={20} />
                </div>
                <span className="font-semibold text-sm block text-slate-100">
                  {images.length > 0 ? '点击或拖拽添加更多参考视角' : '点击或拖拽上传产品图片'}
                </span>
                <span className="text-xs text-slate-400 block mt-1">
                  支持 PNG / JPG / WebP，最多 5 张。包含正视、侧视、俯视等多视角时重建效果最佳
                </span>
              </div>

              {/* 图片预览列表 */}
              {images.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span>已上传参考图片 ({images.length} / 5)</span>
                    <button
                      type="button"
                      onClick={() => {
                        images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
                        setImages([]);
                      }}
                      className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      清空全部
                    </button>
                  </div>
                  <div className="flex gap-2.5 flex-wrap">
                    {images.map((img, idx) => (
                      <div key={img.id} className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/10 bg-black/40 group shadow-md">
                        <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-medium text-slate-200">
                          {idx === 0 ? '主视参考' : `视角 ${idx + 1}`}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRemoveImage(img.id); }}
                          className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-rose-600 rounded-md text-white opacity-0 group-hover:opacity-100 transition-all shadow"
                          aria-label="移除图片"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 生成进度 */}
          {isGenerating && (
            <div className="space-y-3 p-4 rounded-xl border border-cyan-400/20 bg-cyan-950/20">
              <div className="flex items-center gap-2 text-sm text-cyan-300">
                <Loader2 size={16} className="animate-spin" />
                <span>{statusText}</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-right text-[11px] text-slate-400 font-mono">{Math.round(progress)}%</div>
              <p className="text-[10px] text-slate-500">
                生成通常需要 30 秒 - 3 分钟，取决于模型复杂度和 API 服务器负载。请保持此窗口打开。
              </p>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <ErrorNoticePanel
              title="AI 3D 生成失败"
              message={error}
              details={`生成模式: ${genMode}\n服务商: ${genMode === 'img2threejs' ? llmConfig.providerId : PROVIDER_LABELS[config.provider]}\n图片数量: ${images.length}\n代理地址: ${config.proxyUrl || '系统默认本地安全中继'}\n代理状态: ${proxyStatus}`}
              onRetry={images.length > 0 && !isGenerating ? () => void handleGenerate() : undefined}
              onDismiss={() => setError('')}
            />
          )}

          {/* 三个效果预览说明 */}
          {!isGenerating && images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-lg text-center">
                <Layers size={16} className="mx-auto text-cyan-400 mb-1" />
                <div className="text-[10px] font-semibold text-cyan-300">分层</div>
                <div className="text-[9px] text-slate-500">模型部件逐层展开</div>
              </div>
              <div className="p-2.5 bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/20 rounded-lg text-center">
                <Zap size={16} className="mx-auto text-orange-400 mb-1" />
                <div className="text-[10px] font-semibold text-orange-300">爆炸</div>
                <div className="text-[9px] text-slate-500">部件向外飞散效果</div>
              </div>
              <div className="p-2.5 bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 rounded-lg text-center">
                <Atom size={16} className="mx-auto text-purple-400 mb-1" />
                <div className="text-[10px] font-semibold text-purple-300">碰撞</div>
                <div className="text-[9px] text-slate-500">物理引擎真实碰撞</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between gap-2 bg-[#12141c]">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span>当前生成方式：</span>
            <span className={genMode === 'seed3d' ? 'text-cyan-300 font-medium' : 'text-purple-300 font-medium'}>
              {genMode === 'seed3d' ? PROVIDER_LABELS[config.provider] : '视觉大模型代码生成'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-xs font-semibold text-slate-300 transition-colors disabled:opacity-40"
              aria-label="取消 AI 3D 生成"
            >
              取消
            </button>
            <button
              type="button"
              disabled={!images.length || isGenerating}
              onClick={() => {
                if (!images.length) {
                  setError('请先上传至少一张产品图片');
                  return;
                }
                if (genMode === 'seed3d' && !config.apiKey.trim()) {
                  setError('请先在下方「API 配置」中填写 API Key');
                  setShowSettings(true);
                  return;
                }
                if (genMode === 'img2threejs' && !llmConfig.apiKey?.trim()) {
                  setError('请先在下方「API 配置」中填写视觉大模型 API Key');
                  setShowSettings(true);
                  return;
                }
                void handleGenerate();
              }}
              title={
                !images.length
                  ? '请先上传产品图片'
                  : (genMode === 'seed3d' && !config.apiKey.trim())
                  ? '请在 API 配置中填写 API Key'
                  : (genMode === 'img2threejs' && !llmConfig.apiKey?.trim())
                  ? '请在 API 配置中填写视觉大模型 API Key'
                  : '开始生成 3D 模型'
              }
              className={`px-5 py-1.5 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 transition-all ${
                !images.length || isGenerating ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              <Sparkles size={14} />
              <span>{isGenerating ? '生成中...' : '生成 3D 模型'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
