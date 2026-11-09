import { describe, expect, it } from 'vitest';
import { translateInterfaceText } from '../src/i18n/LanguageContext';

describe('i18n 组合文本翻译', () => {
  it('翻译带 emoji 前缀的已知词组', () => {
    expect(translateInterfaceText('🎬 画布场景', 'en-US')).toBe('🎬 Canvas Scene');
  });

  it('翻译带单位后缀的转场名', () => {
    expect(translateInterfaceText('淡入 (0.8s)', 'en-US')).toBe('Fade In (0.8s)');
  });

  it('未完全覆盖时保持原文，避免半中半英', () => {
    expect(translateInterfaceText('画布场景与未知分组', 'en-US')).toBe('画布场景与未知分组');
    expect(translateInterfaceText('赛博发光圆环图', 'en-US')).toBe('赛博发光圆环图');
  });

  it('中文模式下不做组合替换', () => {
    expect(translateInterfaceText('🎬 画布场景', 'zh-CN')).toBe('🎬 画布场景');
  });

  it('忽略空白差异匹配文案', () => {
    expect(translateInterfaceText('切换到场 景设置', 'en-US')).toBe('Switch to Scene Settings');
  });

  it('统一半角/全角括号后匹配', () => {
    expect(translateInterfaceText('未分配分组 (独立图层)', 'en-US')).toBe('Ungrouped (independent layer)');
  });

  it('翻译带 emoji 与英文混排的短标签', () => {
    expect(translateInterfaceText('出: 🌫️ Fade In', 'en-US')).toBe('Out: 🌫️ Fade In');
  });
});
