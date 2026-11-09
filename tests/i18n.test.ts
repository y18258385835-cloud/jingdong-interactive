import { describe, expect, it } from 'vitest';
import { interfaceTranslations, translateInterfaceText } from '../src/i18n/LanguageContext';

describe('Internationalization (i18n)', () => {
  it('translates component cards from Chinese to English', () => {
    expect(translateInterfaceText('基础 UI 交互控件库', 'en-US')).toBe('UI Interactive Controls');
    expect(translateInterfaceText('官方业务与交互组件', 'en-US')).toBe('Official Business Components');
    expect(translateInterfaceText('手势联动与事件触发', 'en-US')).toBe('Gesture & Event Triggers');
    expect(translateInterfaceText('3D 三维模型与空间', 'en-US')).toBe('3D Models & Spatial Scene');
    expect(translateInterfaceText('自定义代码微组件', 'en-US')).toBe('Custom Code Components');
    expect(translateInterfaceText('极客扩展', 'en-US')).toBe('Geek Extension');
    expect(translateInterfaceText('体感联动', 'en-US')).toBe('Gesture Control');
    expect(translateInterfaceText('业务套件', 'en-US')).toBe('Business Suite');
    expect(translateInterfaceText('UI组件', 'en-US')).toBe('UI Components');
  });

  it('translates design cards and visual studio from Chinese to English', () => {
    expect(translateInterfaceText('高级视觉工坊', 'en-US')).toBe('Advanced Visual Studio');
    expect(translateInterfaceText('几何形状与预设库', 'en-US')).toBe('Shape & Preset Library');
    expect(translateInterfaceText('视觉动态光效 (VFX)', 'en-US')).toBe('Dynamic Visual Effects (VFX)');
    expect(translateInterfaceText('Saber 霓虹能量光线', 'en-US')).toBe('Saber Neon Energy Beam');
    expect(translateInterfaceText('智能卡片与自适应容器', 'en-US')).toBe('Smart Cards & Adaptive Containers');
    expect(translateInterfaceText('50+ 预设', 'en-US')).toBe('50+ Presets');
    expect(translateInterfaceText('GPU加速', 'en-US')).toBe('GPU Accelerated');
    expect(translateInterfaceText('赛博光辉', 'en-US')).toBe('Cyber Glow');
    expect(translateInterfaceText('毛玻璃', 'en-US')).toBe('Glassmorphism');
    expect(translateInterfaceText('几何矩形', 'en-US')).toBe('Geometric Rect');
    expect(translateInterfaceText('能量光线', 'en-US')).toBe('Energy Beam');
    expect(translateInterfaceText('全景空间', 'en-US')).toBe('Panorama 360');
  });

  it('translates dynamic pattern expressions correctly', () => {
    expect(translateInterfaceText('共 12 个图层', 'en-US')).toBe('12 layers');
    expect(translateInterfaceText('3 个场景', 'en-US')).toBe('3 scenes');
    expect(translateInterfaceText('8 个素材', 'en-US')).toBe('8 assets');
    expect(translateInterfaceText('2 个绑定', 'en-US')).toBe('2 bindings');
    expect(translateInterfaceText('已选 4 项', 'en-US')).toBe('4 selected');
    expect(translateInterfaceText('当前缩放: 100%', 'en-US')).toBe('Current zoom: 100%');
    expect(translateInterfaceText('当前标记: 2.5s', 'en-US')).toBe('Current marker: 2.5s');
    expect(translateInterfaceText('时长: 15s', 'en-US')).toBe('Duration: 15s');
    expect(translateInterfaceText('场景 1', 'en-US')).toBe('Scene 1');
    expect(translateInterfaceText('图层 3', 'en-US')).toBe('Layer 3');
    expect(translateInterfaceText('第 15 帧', 'en-US')).toBe('Frame 15');
    expect(translateInterfaceText('未命名工程 - 场景 2', 'en-US')).toBe('Untitled Project - Scene 2');
  });

  it('preserves text when language is zh-CN', () => {
    expect(translateInterfaceText('基础 UI 交互控件库', 'zh-CN')).toBe('基础 UI 交互控件库');
    expect(translateInterfaceText('高级视觉工坊', 'zh-CN')).toBe('高级视觉工坊');
    expect(translateInterfaceText('共 12 个图层', 'zh-CN')).toBe('共 12 个图层');
  });
});
