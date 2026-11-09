/**
 * 新手引导组件
 * 首次使用的分步引导、关键功能气泡提示
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, ChevronRight, ChevronLeft, Check, Sparkles,
  MousePointerClick, Layers, Download, Settings,
} from 'lucide-react';

interface OnboardingGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

interface GuideStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  highlight?: string; // CSS选择器，用于高亮元素
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'welcome',
    title: '欢迎使用 鲸动交互平台',
    description: '鲸动交互平台 是一款沉浸式交互媒体工作台，支持全景图、3D模型、高斯泼溅等富媒体内容的创作与编辑。让我们花1分钟了解核心功能。',
    icon: <Sparkles size={28} className="text-cyan-400" />,
    position: 'center',
  },
  {
    id: 'scenes',
    title: '场景管理',
    description: '左侧面板管理所有场景。点击场景切换，右键可重命名、复制、删除。支持场景间转场动画。',
    icon: <Layers size={28} className="text-purple-400" />,
    position: 'left',
  },
  {
    id: 'canvas',
    title: '画布编辑',
    description: '中央画布是主要编辑区域。拖拽元素移动，拖拽边角缩放，双击文字可编辑。全景/3D元素拖拽控制视角。',
    icon: <MousePointerClick size={28} className="text-emerald-400" />,
    position: 'center',
  },
  {
    id: 'timeline',
    title: '时间线编辑',
    description: '底部时间线控制元素的出现时间和时长。拖拽素材调整位置，拖拽边缘调整时长。支持多轨道精确编辑。',
    icon: <Layers size={28} className="text-amber-400" />,
    position: 'bottom',
  },
  {
    id: 'export',
    title: '导出作品',
    description: '点击顶部"导出"按钮，支持工程文件（ZIP/HTML）和高级导出（图片/视频/网页）。免费版导出带水印，专业版无限制。',
    icon: <Download size={28} className="text-rose-400" />,
    position: 'top',
  },
  {
    id: 'complete',
    title: '准备就绪！',
    description: '你已了解鲸动交互平台的核心功能。点击"开始创作"进入编辑器，或查看示例工程了解更多玩法。随时按 F1 查看快捷键。',
    icon: <Check size={28} className="text-cyan-400" />,
    position: 'center',
  },
];

export const OnboardingGuide: React.FC<OnboardingGuideProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setCurrentStep(0);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setIsVisible(false);
      onClose();
      try {
        localStorage.setItem('aether_onboarding_skipped', 'true');
      } catch {}
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleNext = useCallback(() => {
    if (currentStep < GUIDE_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }, [currentStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleComplete = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
      onComplete?.();
    }, 200);
  }, [onClose, onComplete]);

  const handleSkip = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
      // 记录用户跳过引导
      try {
        localStorage.setItem('aether_onboarding_skipped', 'true');
      } catch {}
    }, 200);
  }, [onClose]);

  if (!isOpen && !isVisible) return null;

  const step = GUIDE_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === GUIDE_STEPS.length - 1;

  return (
    <div
      className={`fixed inset-0 z-[300] transition-opacity duration-200 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* 引导卡片 */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={`w-full max-w-md bg-[#12141c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
            isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
          }`}
        >
          {/* 进度条 */}
          <div className="h-1 bg-white/5">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-300"
              style={{ width: `${((currentStep + 1) / GUIDE_STEPS.length) * 100}%` }}
            />
          </div>

          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={handleSkip}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors z-10"
            title="跳过引导"
          >
            <X size={18} />
          </button>

          {/* 内容区 */}
          <div className="p-8">
            {/* 图标 */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                {step.icon}
              </div>
            </div>

            {/* 标题 */}
            <h2 className="text-xl font-bold text-white text-center mb-3">
              {step.title}
            </h2>

            {/* 描述 */}
            <p className="text-sm text-slate-400 text-center leading-relaxed mb-8">
              {step.description}
            </p>

            {/* 步骤指示器 */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {GUIDE_STEPS.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setCurrentStep(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentStep
                      ? 'w-6 bg-cyan-400'
                      : index < currentStep
                      ? 'bg-cyan-500/50'
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                />
              ))}
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrev}
                disabled={isFirstStep}
                className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isFirstStep
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <ChevronLeft size={16} />
                上一步
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSkip}
                  className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 transition-colors"
                >
                  跳过
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-400 hover:to-purple-500 transition-all shadow-lg shadow-cyan-500/20"
                >
                  {isLastStep ? (
                    <>
                      <Check size={16} />
                      开始创作
                    </>
                  ) : (
                    <>
                      下一步
                      <ChevronRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 底部提示 */}
          <div className="px-8 py-3 bg-white/[0.02] border-t border-white/5">
            <p className="text-[10px] text-slate-600 text-center">
              步骤 {currentStep + 1} / {GUIDE_STEPS.length} · 按 ESC 跳过 · 随时可在设置中重新查看
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 检查是否应该显示新手引导
 * 首次使用或未完成引导时显示
 */
export function shouldShowOnboarding(): boolean {
  try {
    const completed = localStorage.getItem('aether_onboarding_completed');
    const skipped = localStorage.getItem('aether_onboarding_skipped');
    return !completed && !skipped;
  } catch {
    return true;
  }
}

/**
 * 标记新手引导已完成
 */
export function markOnboardingCompleted(): void {
  try {
    localStorage.setItem('aether_onboarding_completed', 'true');
    localStorage.setItem('aether_onboarding_completed_at', new Date().toISOString());
  } catch {}
}
