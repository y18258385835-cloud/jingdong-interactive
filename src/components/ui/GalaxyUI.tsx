import React, { useState } from 'react';
import { Icon, IconName } from './Icon';

// ============================================
// Galaxy 风格按钮组件
// ============================================

export type GalaxyButtonVariant =
  | 'primary'        // 主按钮（渐变）
  | 'secondary'      // 次按钮（边框）
  | 'ghost'          // 幽灵按钮（透明）
  | 'gradient'       // 渐变按钮
  | 'glow'           // 发光按钮
  | '3d'             // 3D按钮
  | 'neon'           // 霓虹按钮
  | 'glass'          // 玻璃态按钮
  | 'icon-reveal'    // 图标展开按钮
  | 'slide'          // 滑动填充按钮
  | 'pulse'          // 脉冲按钮
  | 'shine';         // 光泽按钮

interface GalaxyButtonProps {
  variant?: GalaxyButtonVariant;
  children: React.ReactNode;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

export const GalaxyButton: React.FC<GalaxyButtonProps> = ({
  variant = 'primary',
  children,
  icon,
  iconPosition = 'left',
  onClick,
  disabled = false,
  size = 'md',
  color = '#06b6d4',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const variantStyles: Record<GalaxyButtonVariant, React.CSSProperties> = {
    primary: {
      background: `linear-gradient(135deg, ${color}, ${color}dd)`,
      color: 'white',
      border: 'none',
      boxShadow: `0 4px 15px ${color}40`,
    },
    secondary: {
      background: 'transparent',
      color,
      border: `2px solid ${color}`,
    },
    ghost: {
      background: 'transparent',
      color,
      border: 'none',
    },
    gradient: {
      background: `linear-gradient(135deg, ${color}, #a855f7, #ec4899)`,
      color: 'white',
      border: 'none',
      boxShadow: '0 4px 20px rgba(168, 85, 247, 0.4)',
    },
    glow: {
      background: color,
      color: 'white',
      border: 'none',
      boxShadow: `0 0 20px ${color}, 0 0 40px ${color}60`,
    },
    '3d': {
      background: color,
      color: 'white',
      border: 'none',
      boxShadow: `0 6px 0 ${color}99, 0 8px 20px rgba(0,0,0,0.3)`,
      transform: 'translateY(-2px)',
    },
    neon: {
      background: 'transparent',
      color,
      border: `2px solid ${color}`,
      boxShadow: `0 0 10px ${color}60, inset 0 0 10px ${color}20`,
      textShadow: `0 0 10px ${color}`,
    },
    glass: {
      background: 'rgba(255,255,255,0.1)',
      color: 'white',
      border: '1px solid rgba(255,255,255,0.2)',
      backdropFilter: 'blur(10px)',
    },
    'icon-reveal': {
      background: 'white',
      color: '#333',
      border: 'none',
    },
    slide: {
      background: 'transparent',
      color,
      border: `2px solid ${color}`,
      overflow: 'hidden',
      position: 'relative',
    },
    pulse: {
      background: color,
      color: 'white',
      border: 'none',
      animation: 'galaxy-pulse 2s infinite',
    },
    shine: {
      background: color,
      color: 'white',
      border: 'none',
      overflow: 'hidden',
      position: 'relative',
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative inline-flex items-center justify-center gap-2 font-medium rounded-lg
        transition-all duration-300 cursor-pointer select-none
        ${sizeClasses[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
        ${className}
      `}
      style={variantStyles[variant]}
    >
      {variant === 'slide' && (
        <span
          className="absolute inset-0 transition-transform duration-300 -translate-x-full hover:translate-x-0"
          style={{ background: color }}
        />
      )}
      {variant === 'shine' && (
        <span
          className="absolute inset-0 -translate-x-full hover:translate-x-full transition-transform duration-700"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }}
        />
      )}
      {icon && iconPosition === 'left' && <Icon name={icon} size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
      <span className="relative z-10">{children}</span>
      {icon && iconPosition === 'right' && <Icon name={icon} size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
      <style>{`
        @keyframes galaxy-pulse {
          0%, 100% { box-shadow: 0 0 0 0 ${color}80; }
          50% { box-shadow: 0 0 0 15px ${color}00; }
        }
      `}</style>
    </button>
  );
};

// ============================================
// Galaxy 风格卡片组件
// ============================================

export type GalaxyCardVariant =
  | 'default'       // 默认卡片
  | 'gradient'      // 渐变卡片
  | 'glass'         // 玻璃态卡片
  | 'neon'          // 霓虹卡片
  | '3d'            // 3D卡片
  | 'hover-lift'    // 悬停升起
  | 'border-glow'   // 边框发光
  | 'tilt';         // 倾斜卡片

interface GalaxyCardProps {
  variant?: GalaxyCardVariant;
  children: React.ReactNode;
  title?: string;
  icon?: IconName;
  color?: string;
  className?: string;
  onClick?: () => void;
}

export const GalaxyCard: React.FC<GalaxyCardProps> = ({
  variant = 'default',
  children,
  title,
  icon,
  color = '#06b6d4',
  className = '',
  onClick,
}) => {
  const variantStyles: Record<GalaxyCardVariant, React.CSSProperties> = {
    default: {
      background: 'white',
      border: '1px solid #e5e7eb',
    },
    gradient: {
      background: `linear-gradient(135deg, ${color}10, ${color}05)`,
      border: `1px solid ${color}30`,
    },
    glass: {
      background: 'rgba(255,255,255,0.1)',
      border: '1px solid rgba(255,255,255,0.2)',
      backdropFilter: 'blur(10px)',
    },
    neon: {
      background: 'rgba(0,0,0,0.8)',
      border: `2px solid ${color}`,
      boxShadow: `0 0 20px ${color}40, inset 0 0 20px ${color}10`,
    },
    '3d': {
      background: 'white',
      border: 'none',
      boxShadow: '0 10px 30px rgba(0,0,0,0.15), 0 4px 10px rgba(0,0,0,0.1)',
      transform: 'perspective(1000px) rotateX(2deg)',
    },
    'hover-lift': {
      background: 'white',
      border: '1px solid #e5e7eb',
      transition: 'all 0.3s ease',
    },
    'border-glow': {
      background: 'white',
      border: `2px solid transparent`,
      backgroundImage: `linear-gradient(white, white), linear-gradient(135deg, ${color}, #a855f7)`,
      backgroundOrigin: 'border-box',
      backgroundClip: 'padding-box, border-box',
    },
    tilt: {
      background: 'white',
      border: '1px solid #e5e7eb',
      transform: 'perspective(1000px) rotateY(-3deg) rotateX(2deg)',
      transition: 'transform 0.3s ease',
    },
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-xl p-5 overflow-hidden
        ${variant === 'hover-lift' ? 'hover:-translate-y-2 hover:shadow-2xl' : ''}
        ${variant === 'tilt' ? 'hover:rotate-y-0 hover:rotate-x-0' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      style={variantStyles[variant]}
    >
      {(title || icon) && (
        <div className="flex items-center gap-3 mb-3">
          {icon && (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: `${color}20`, color }}
            >
              <Icon name={icon} size={20} />
            </div>
          )}
          {title && <h3 className="text-lg font-bold text-gray-800">{title}</h3>}
        </div>
      )}
      <div className="text-gray-600">{children}</div>
    </div>
  );
};

// ============================================
// Galaxy 风格加载器组件
// ============================================

export type GalaxyLoaderVariant =
  | 'spinner'       // 旋转加载
  | 'dots'          // 跳动点
  | 'pulse'         // 脉冲
  | 'bars'          // 条形
  | 'ring'          // 环形
  | 'gradient'      // 渐变旋转
  | 'orbit'         // 轨道
  | 'wave';         // 波浪

interface GalaxyLoaderProps {
  variant?: GalaxyLoaderVariant;
  size?: number;
  color?: string;
  text?: string;
  className?: string;
}

export const GalaxyLoader: React.FC<GalaxyLoaderProps> = ({
  variant = 'spinner',
  size = 40,
  color = '#06b6d4',
  text,
  className = '',
}) => {
  const loaders: Record<GalaxyLoaderVariant, React.ReactNode> = {
    spinner: (
      <div
        className="rounded-full border-4 border-t-transparent animate-spin"
        style={{ width: size, height: size, borderColor: `${color}30`, borderTopColor: color }}
      />
    ),
    dots: (
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-full animate-bounce"
            style={{
              width: size / 4,
              height: size / 4,
              background: color,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    ),
    pulse: (
      <div
        className="rounded-full animate-ping"
        style={{ width: size, height: size, background: `${color}40` }}
      />
    ),
    bars: (
      <div className="flex gap-1 items-end" style={{ height: size }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-1.5 rounded-full animate-pulse"
            style={{
              height: `${30 + Math.random() * 70}%`,
              background: color,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    ),
    ring: (
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className="absolute inset-0 rounded-full border-4"
          style={{ borderColor: `${color}20` }}
        />
        <div
          className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
          style={{ borderTopColor: color, borderRightColor: color }}
        />
      </div>
    ),
    gradient: (
      <div
        className="rounded-full animate-spin"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(from 0deg, ${color}, #a855f7, #ec4899, ${color})`,
          mask: 'radial-gradient(circle, transparent 60%, black 60%)',
          WebkitMask: 'radial-gradient(circle, transparent 60%, black 60%)',
        }}
      />
    ),
    orbit: (
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: `${color}30` }}
        />
        <div
          className="absolute w-3 h-3 rounded-full animate-spin"
          style={{
            background: color,
            top: -6,
            left: '50%',
            marginLeft: -6,
            transformOrigin: `6px ${size / 2 + 6}px`,
          }}
        />
      </div>
    ),
    wave: (
      <div className="flex gap-1 items-center" style={{ height: size }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-1.5 rounded-full"
            style={{
              height: '40%',
              background: color,
              animation: `galaxy-wave 1s ease-in-out infinite`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
        <style>{`
          @keyframes galaxy-wave {
            0%, 100% { height: 40%; }
            50% { height: 100%; }
          }
        `}</style>
      </div>
    ),
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      {loaders[variant]}
      {text && <p className="text-sm text-gray-500">{text}</p>}
    </div>
  );
};

// ============================================
// Galaxy 风格通知组件
// ============================================

export type GalaxyNotificationType = 'success' | 'error' | 'warning' | 'info';

interface GalaxyNotificationProps {
  type: GalaxyNotificationType;
  title: string;
  message?: string;
  onClose?: () => void;
  className?: string;
}

export const GalaxyNotification: React.FC<GalaxyNotificationProps> = ({
  type,
  title,
  message,
  onClose,
  className = '',
}) => {
  const config = {
    success: { color: '#10b981', icon: 'check-circle' as IconName, bg: 'rgba(16, 185, 129, 0.1)' },
    error: { color: '#ef4444', icon: 'x-circle' as IconName, bg: 'rgba(239, 68, 68, 0.1)' },
    warning: { color: '#f59e0b', icon: 'alert-circle' as IconName, bg: 'rgba(245, 158, 11, 0.1)' },
    info: { color: '#3b82f6', icon: 'info-circle' as IconName, bg: 'rgba(59, 130, 246, 0.1)' },
  };

  const { color, icon, bg } = config[type];

  return (
    <div
      className={`
        relative flex items-start gap-3 p-4 rounded-xl overflow-hidden
        animate-slide-in
        ${className}
      `}
      style={{
        background: bg,
        borderLeft: `4px solid ${color}`,
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}20`, color }}
      >
        <Icon name={icon} size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-sm" style={{ color }}>{title}</h4>
        {message && <p className="text-xs text-gray-600 mt-1">{message}</p>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          <Icon name="x" size={16} />
        </button>
      )}
      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// ============================================
// Galaxy 风格开关组件
// ============================================

interface GalaxyToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}

export const GalaxyToggle: React.FC<GalaxyToggleProps> = ({
  checked,
  onChange,
  label,
  color = '#06b6d4',
  size = 'md',
  disabled = false,
  className = '',
}) => {
  const sizes = {
    sm: { width: 36, height: 20, dot: 16 },
    md: { width: 48, height: 26, dot: 22 },
    lg: { width: 60, height: 32, dot: 28 },
  };

  const { width, height, dot } = sizes[size];

  return (
    <label className={`inline-flex items-center gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
      <div
        className="relative rounded-full transition-all duration-300"
        style={{
          width,
          height,
          background: checked ? color : '#d1d5db',
          boxShadow: checked ? `0 0 15px ${color}60` : 'none',
        }}
        onClick={() => !disabled && onChange(!checked)}
      >
        <div
          className="absolute rounded-full bg-white shadow-md transition-all duration-300"
          style={{
            width: dot,
            height: dot,
            top: (height - dot) / 2,
            left: checked ? width - dot - (height - dot) / 2 : (height - dot) / 2,
          }}
        />
      </div>
      {label && <span className="text-sm text-gray-700 select-none">{label}</span>}
    </label>
  );
};

// ============================================
// Galaxy 风格进度条组件
// ============================================

interface GalaxyProgressProps {
  value: number; // 0-100
  color?: string;
  variant?: 'default' | 'gradient' | 'striped' | 'animated';
  height?: number;
  showLabel?: boolean;
  className?: string;
}

export const GalaxyProgress: React.FC<GalaxyProgressProps> = ({
  value,
  color = '#06b6d4',
  variant = 'default',
  height = 8,
  showLabel = false,
  className = '',
}) => {
  const getBackground = () => {
    switch (variant) {
      case 'gradient':
        return `linear-gradient(90deg, ${color}, #a855f7)`;
      case 'striped':
        return `repeating-linear-gradient(45deg, ${color}, ${color} 10px, ${color}cc 10px, ${color}cc 20px)`;
      case 'animated':
        return `linear-gradient(90deg, ${color}, ${color}88, ${color})`;
      default:
        return color;
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-500">进度</span>
          <span className="text-xs font-bold" style={{ color }}>{value}%</span>
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden bg-gray-200"
        style={{ height }}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${variant === 'animated' ? 'animate-pulse' : ''}`}
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
            background: getBackground(),
            boxShadow: `0 0 10px ${color}40`,
          }}
        />
      </div>
    </div>
  );
};

// ============================================
// Galaxy 风格徽章组件
// ============================================

interface GalaxyBadgeProps {
  children: React.ReactNode;
  color?: string;
  variant?: 'solid' | 'outline' | 'soft';
  icon?: IconName;
  className?: string;
}

export const GalaxyBadge: React.FC<GalaxyBadgeProps> = ({
  children,
  color = '#06b6d4',
  variant = 'soft',
  icon,
  className = '',
}) => {
  const styles = {
    solid: { background: color, color: 'white' },
    outline: { background: 'transparent', color, border: `1px solid ${color}` },
    soft: { background: `${color}20`, color },
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={styles[variant]}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
};

// ============================================
// Galaxy UI 组件库导出
// ============================================

export const GalaxyUI = {
  Button: GalaxyButton,
  Card: GalaxyCard,
  Loader: GalaxyLoader,
  Notification: GalaxyNotification,
  Toggle: GalaxyToggle,
  Progress: GalaxyProgress,
  Badge: GalaxyBadge,
};

export default GalaxyUI;
