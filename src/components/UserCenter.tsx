/**
 * 用户中心组件
 * 登录/注册、个人中心、用量统计与限制
 */

import React, { useState } from 'react';
import {
  X, User, Mail, Lock, LogOut, Crown, HardDrive,
  Download, Image, Video, Clock, Check, AlertCircle,
  Settings, CreditCard, ChevronRight,
} from 'lucide-react';

interface UserCenterProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserInfo | null;
  onLogin?: (email: string, password: string) => void;
  onRegister?: (email: string, password: string) => void;
  onLogout?: () => void;
  onUpgrade?: () => void;
}

export interface UserInfo {
  id: string;
  email: string;
  nickname: string;
  avatar?: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: string;
  lastLoginAt: string;
}

export interface UsageStats {
  projectCount: number;
  projectLimit: number;
  exportCount: number;
  exportLimit: number;
  storageUsed: number;
  storageLimit: number;
  videoExportCount: number;
  videoExportLimit: number;
}

// 默认用户信息（未登录状态）
const DEFAULT_USER: UserInfo = {
  id: 'guest',
  email: '',
  nickname: '访客用户',
  plan: 'free',
  createdAt: '',
  lastLoginAt: '',
};

// 默认用量统计
const DEFAULT_USAGE: UsageStats = {
  projectCount: 1,
  projectLimit: 3,
  exportCount: 3,
  exportLimit: 10,
  storageUsed: 15.6,
  storageLimit: 0,
  videoExportCount: 1,
  videoExportLimit: 5,
};

export const UserCenter: React.FC<UserCenterProps> = ({
  isOpen,
  onClose,
  user = DEFAULT_USER,
  onLogin,
  onRegister,
  onLogout,
  onUpgrade,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'profile'>('profile');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage] = useState<UsageStats>(DEFAULT_USAGE);

  if (!isOpen) return null;

  const isLoggedIn = user.id !== 'guest';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('请填写邮箱和密码');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);

    if (mode === 'login') {
      onLogin?.(email, password);
    } else {
      onRegister?.(email, password);
    }
    setMode('profile');
  };

  const getPlanLabel = (plan: string) => {
    switch (plan) {
      case 'pro': return '专业版';
      case 'enterprise': return '企业版';
      default: return '免费版';
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'pro': return 'from-cyan-500 to-purple-600';
      case 'enterprise': return 'from-amber-500 to-orange-600';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const UsageBar: React.FC<{
    icon: React.ReactNode;
    label: string;
    used: number;
    limit: number;
    unit?: string;
  }> = ({ icon, label, used, limit, unit = '' }) => {
    const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
    const isNearLimit = percentage >= 80;
    const isUnlimited = limit === 0;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">{icon}</span>
            <span className="text-sm text-slate-300">{label}</span>
          </div>
          <span className={`text-xs font-mono ${isNearLimit ? 'text-amber-400' : 'text-slate-400'}`}>
            {isUnlimited ? '无限' : `${used} / ${limit}${unit}`}
          </span>
        </div>
        {!isUnlimited && (
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isNearLimit ? 'bg-amber-500' : 'bg-cyan-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#12141c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {mode === 'login' ? '登录' : mode === 'register' ? '注册' : '个人中心'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 登录/注册表单 */}
        {(mode === 'login' || mode === 'register') && (
          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-400 shrink-0" />
                <span className="text-sm text-rose-300">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">邮箱</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">密码</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
                  />
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">确认密码</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm font-medium hover:from-cyan-400 hover:to-purple-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    处理中...
                  </>
                ) : (
                  mode === 'login' ? '登录' : '注册'
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              <span className="text-sm text-slate-500">
                {mode === 'login' ? '还没有账号？' : '已有账号？'}
              </span>
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="ml-1 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {mode === 'login' ? '立即注册' : '立即登录'}
              </button>
            </div>
          </div>
        )}

        {/* 个人中心 */}
        {mode === 'profile' && (
          <div className="p-6">
            {!isLoggedIn ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <User size={32} className="text-slate-500" />
                </div>
                <p className="text-slate-400 mb-4">登录后同步工程和用量统计</p>
                <div className="flex gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
                  >
                    登录
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm hover:from-cyan-400 hover:to-purple-500 transition-all"
                  >
                    注册
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 用户信息 */}
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${getPlanColor(user.plan)} flex items-center justify-center text-white text-xl font-bold`}>
                    {user.nickname.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white">{user.nickname}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r ${getPlanColor(user.plan)} text-white`}>
                        {getPlanLabel(user.plan)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">{user.email}</p>
                  </div>
                </div>

                {/* 用量统计 */}
                <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock size={14} className="text-cyan-400" />
                    本月用量
                  </h4>
                  <UsageBar
                    icon={<HardDrive size={14} />}
                    label="工程数量"
                    used={usage.projectCount}
                    limit={usage.projectLimit}
                  />
                  <UsageBar
                    icon={<Download size={14} />}
                    label="导出次数"
                    used={usage.exportCount}
                    limit={usage.exportLimit}
                  />
                  <UsageBar
                    icon={<Video size={14} />}
                    label="视频导出"
                    used={usage.videoExportCount}
                    limit={usage.videoExportLimit}
                  />
                  <UsageBar
                    icon={<Image size={14} />}
                    label="云端存储"
                    used={usage.storageUsed}
                    limit={usage.storageLimit}
                    unit=" MB"
                  />
                </div>

                {/* 升级提示 */}
                {user.plan === 'free' && (
                  <div
                    className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-xl p-4 cursor-pointer hover:border-cyan-500/50 transition-all"
                    onClick={onUpgrade}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                          <Crown size={18} className="text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">升级专业版</p>
                          <p className="text-xs text-slate-400">解锁无限导出、4K分辨率、无水印</p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-slate-400" />
                    </div>
                  </div>
                )}

                {/* 操作菜单 */}
                <div className="space-y-1">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white/5 text-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Settings size={16} className="text-slate-400" />
                      <span className="text-sm">账号设置</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-600" />
                  </button>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white/5 text-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard size={16} className="text-slate-400" />
                      <span className="text-sm">订阅管理</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-rose-500/10 text-rose-400 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <LogOut size={16} />
                      <span className="text-sm">退出登录</span>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
