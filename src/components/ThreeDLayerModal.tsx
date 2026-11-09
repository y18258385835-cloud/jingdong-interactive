import React, { useState, useRef, useEffect } from 'react';
import { Layers, Upload, X, Sparkles, Check, Move3d } from 'lucide-react';
import { dbManager, processImageFile } from '../utils/db';
import { SceneElement } from '../types';

interface ThreeDLayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd3DLayers: (layers: SceneElement[], asset?: { key: string; blob: Blob; name: string }) => void;
  sceneDuration: number;
  onError?: (message: string) => void;
}

export const ThreeDLayerModal: React.FC<ThreeDLayerModalProps> = ({
  isOpen,
  onClose,
  onAdd3DLayers,
  sceneDuration,
  onError,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [layerCount, setLayerCount] = useState<number>(5);
  const [depthIntensity, setDepthIntensity] = useState<number>(35);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  // 预览 blob URL 的引用，用于组件卸载时释放，防止内存泄漏
  const previewUrlRef = useRef<string>('');

  // 组件卸载时释放预览 blob URL，防止内存泄漏
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        try {
          URL.revokeObjectURL(previewUrlRef.current);
        } catch {
          /* 忽略释放失败 */
        }
        previewUrlRef.current = '';
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen || isProcessing) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    // 释放旧预览 URL（若存在），避免累积泄漏
    if (previewUrlRef.current) {
      try {
        URL.revokeObjectURL(previewUrlRef.current);
      } catch {
        /* 忽略 */
      }
    }
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  };

  const handleMouseMovePreview = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const x = (e.clientX - cx) / (rect.width / 2);
    const y = (e.clientY - cy) / (rect.height / 2);
    setTilt({ x: x * 15, y: -y * 15 });
  };

  const handleGenerate = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);

    try {
      const blob = await processImageFile(selectedFile);
      const refKey = 'res_3d_' + Date.now();
      await dbManager.put(refKey, blob);

      const generatedElements: SceneElement[] = [];

      for (let i = 0; i < layerCount; i++) {
        const depth = i / (layerCount - 1 || 1); // 0 (foreground front) to 1 (background rear)
        const scaleOffset = (1 - depth) * 14;
        const depthZ = Math.round((0.5 - depth) * depthIntensity * 3.5);
        const parallaxFactor = Math.round((0.25 + (1 - depth) * 0.65) * 100) / 100;

        generatedElements.push({
          id: `el_3d_${Date.now()}_${i}`,
          type: 'img',
          refId: refKey,
          sourceName: `3D 景深分层 #${i + 1} (${Math.round((1 - depth) * 100)}% 视差深度)`,
          x: 25 - (1 - depth) * 4,
          y: 20 + depth * 3,
          w: 50 + scaleOffset,
          h: 45 + scaleOffset * 0.7,
          rot: (depth - 0.5) * 2,
          zIndex: 10 + (layerCount - i),
          opacity: Math.round(100 - depth * 25),
          blendMode: i === 0 ? 'screen' : 'normal',
          startTime: 0,
          duration: sceneDuration,
          animType: 'zoom-in',
          animDur: 0.6 + i * 0.1,
          exitAnimType: 'fade-out',
          exitAnimDur: 0.5,
          is3dLayer: true,
          depthZ,
          parallaxFactor,
          boxShadow: i === 0 ? '0 30px 60px -15px rgba(0,0,0,0.8)' : undefined,
        });
      }

      onAdd3DLayers(generatedElements, {
        key: refKey,
        blob,
        name: selectedFile.name,
      });
      onClose();
    } catch (err) {
      console.error(err);
      onError?.('3D 分层生成失败');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[10000] flex items-center justify-center p-4" role="presentation">
      <div className="bg-[#141622] border border-purple-500/30 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 text-slate-200" role="dialog" aria-modal="true" aria-labelledby="three-d-layer-title">
        <input
          type="file"
          ref={fileInputRef}
          aria-label="上传用于 3D 分层的图片"
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />

        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-purple-950/20">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-300">
              <Move3d size={18} />
            </div>
            <div>
              <h2 id="three-d-layer-title" className="text-sm font-bold text-white">AI 3D 景深分层生成器 (3D Parallax Slicer)</h2>
              <p className="text-[11px] text-slate-400">将 2D 平面图像分解为深邃的多层视差空间，直接注入时间轴</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md"
            aria-label="关闭 3D 分层窗口"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {!previewUrl ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-purple-500/30 hover:border-purple-400/70 bg-purple-950/10 rounded-xl p-8 text-center cursor-pointer transition-colors"
            >
              <Upload size={32} className="mx-auto text-purple-400 mb-2" />
              <span className="font-semibold text-sm block text-purple-200">点击上传需要 3D 分层的图片</span>
              <span className="text-xs text-slate-400 block mt-1">支持 PNG, JPG, WebP 格式</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Interactive 3D Preview Box */}
              <div
                onMouseMove={handleMouseMovePreview}
                onMouseLeave={() => setTilt({ x: 0, y: 0 })}
                className="h-60 bg-black/60 rounded-xl border border-white/10 overflow-hidden relative flex items-center justify-center perspective-[800px] cursor-move"
              >
                <div
                  style={{
                    transform: `rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)`,
                    transition: 'transform 0.08s ease-out',
                  }}
                  className="relative w-48 h-40 transform-style-3d"
                >
                  {Array.from({ length: layerCount }).map((_, i) => (
                    <img
                      key={i}
                      src={previewUrl}
                      alt="3d layer"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        transform: `translateZ(${(layerCount - i) * 12}px) scale(${1 + i * 0.04})`,
                        opacity: 1 - i * 0.15,
                        filter: i === 0 ? 'drop-shadow(0 10px 20px rgba(168,85,247,0.4))' : 'none',
                      }}
                      className="w-full h-full object-cover rounded-lg border border-purple-500/20"
                    />
                  ))}
                </div>

                <div className="absolute bottom-2 left-3 text-[10px] text-slate-400 bg-black/60 px-2 py-0.5 rounded pointer-events-none">
                  💡 移动鼠标在此区域预览 3D 视差倾斜效果
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute top-2 right-2 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-xs rounded text-white"
                >
                  更换图片
                </button>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-2 gap-4 bg-white/5 p-3 rounded-xl border border-white/10">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">分解层数:</span>
                    <span className="font-mono text-purple-300 font-bold">{layerCount} 层</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="8"
                    value={layerCount}
                    onChange={(e) => setLayerCount(parseInt(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">景深强度:</span>
                    <span className="font-mono text-purple-300 font-bold">{depthIntensity}px</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    value={depthIntensity}
                    onChange={(e) => setDepthIntensity(parseInt(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-end gap-2 bg-[#12141c]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-xs font-semibold text-slate-300"
          >
            取消
          </button>

          <button
            type="button"
            disabled={!selectedFile || isProcessing}
            onClick={handleGenerate}
            className={`px-5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all ${
              !selectedFile || isProcessing ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            <Sparkles size={14} />
            <span>{isProcessing ? '正在生成 3D 层...' : '生成并插入当前场景'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
