import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type AppLanguage = 'zh-CN' | 'en-US';

const LANGUAGE_STORAGE_KEY = 'aether_language';

const messages = {
  'zh-CN': {
    brand: '鲸动交互平台',
    file: '文件', edit: '编辑', scene: '场景', help: '帮助',
    newBlankProject: '新建空白工程', importProject: '导入工程包 / Zip / JSON...', projectManager: '工程管理',
    saveProject: '保存工程', exportProject: '打包导出独立工程 (Zip)...', resetOfficial: '重置为官方示例工程',
    undo: '撤销 (Undo)', redo: '重做 (Redo)', history: '操作历史记录面板...', addText: '添加文字图层',
    addShape: '添加矩形 / 交互卡片', addChart: '添加图表组件', addImage: '添加图片素材', addVideo: '添加视频素材',
    newScene: '新建场景 (New Scene)', shortcuts: '快捷键一览 (Shortcuts)', activate: '激活授权', checkUpdate: '检查更新',
    language: '语言 / Language', languageChinese: '中文', languageEnglish: 'English',
    importFile: '导入工程文件', unnamedProject: '未命名工程', renameProject: '点击重命名工程',
    globalSearch: '全局搜索 (Ctrl/Cmd+K)', openGlobalSearch: '打开全局搜索', search: '搜索',
    storage: '存储层 (IndexedDB + OPFS)', auth: '授权层 (订阅验证)', export: '导出层 (图片/视频/HTML)',
    initializing: '正在初始化...', initError: '部分模块初始化失败，应用将以降级模式运行: ',
  },
  'en-US': {
    brand: 'Jingdong Interactive',
    file: 'File', edit: 'Edit', scene: 'Scene', help: 'Help',
    newBlankProject: 'New Blank Project', importProject: 'Import Project / Zip / JSON...', projectManager: 'Project Manager',
    saveProject: 'Save Project', exportProject: 'Export Standalone Project (Zip)...', resetOfficial: 'Reset to Official Example',
    undo: 'Undo', redo: 'Redo', history: 'History Panel...', addText: 'Add Text Layer',
    addShape: 'Add Rectangle / Interaction Card', addChart: 'Add Chart Component', addImage: 'Add Image Asset', addVideo: 'Add Video Asset',
    newScene: 'New Scene', shortcuts: 'Keyboard Shortcuts', activate: 'Activate License', checkUpdate: 'Check for Updates',
    language: 'Language', languageChinese: '中文', languageEnglish: 'English',
    importFile: 'Import project file', unnamedProject: 'Untitled Project', renameProject: 'Rename project',
    globalSearch: 'Global Search (Ctrl/Cmd+K)', openGlobalSearch: 'Open global search', search: 'Search',
    storage: 'Storage (IndexedDB + OPFS)', auth: 'Authorization (subscription check)', export: 'Export (image/video/HTML)',
    initializing: 'Initializing...', initError: 'Some modules failed to initialize. The app will run in fallback mode: ',
  },
} as const;

export type TranslationKey = keyof typeof messages['zh-CN'];

import { EN_US_INTERFACE } from './locales/en-US';

/** 兼容旧导出：中文原文 → 英文文案。 */
export const interfaceTranslations: Record<string, string> = EN_US_INTERFACE;

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey) => string;
  translateText: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const patternRules: Array<{ pattern: RegExp; toEn: (m: RegExpMatchArray) => string; toZh?: (m: RegExpMatchArray) => string }> = [
  { pattern: /^(.+?)[（(]秒[)）]$/, toEn: (m) => `${interfaceTranslations[m[1].trim()] || m[1].trim()} (s)` },
  { pattern: /^共\s*(\d+)\s*个图层$/, toEn: (m) => `${m[1]} layers`, toZh: (m) => `共 ${m[1]} 个图层` },
  { pattern: /^(\d+)\s*个场景$/, toEn: (m) => `${m[1]} scenes`, toZh: (m) => `${m[1]} 个场景` },
  { pattern: /^(\d+)\s*个素材$/, toEn: (m) => `${m[1]} assets`, toZh: (m) => `${m[1]} 个素材` },
  { pattern: /^(\d+)\s*个绑定$/, toEn: (m) => `${m[1]} bindings`, toZh: (m) => `${m[1]} 个绑定` },
  { pattern: /^已选\s*(\d+)\s*项$/, toEn: (m) => `${m[1]} selected`, toZh: (m) => `已选 ${m[1]} 项` },
  { pattern: /^当前缩放\s*[：:]\s*(\d+)%$/, toEn: (m) => `Current zoom: ${m[1]}%`, toZh: (m) => `当前缩放: ${m[1]}%` },
  { pattern: /^当前标记\s*[：:]\s*([\d.]+)s$/, toEn: (m) => `Current marker: ${m[1]}s`, toZh: (m) => `当前标记: ${m[1]}s` },
  { pattern: /^时长\s*[：:]\s*([\d.]+)s$/, toEn: (m) => `Duration: ${m[1]}s`, toZh: (m) => `时长: ${m[1]}s` },
  { pattern: /^场景\s*(\d+)$/, toEn: (m) => `Scene ${m[1]}`, toZh: (m) => `场景 ${m[1]}` },
  { pattern: /^图层\s*(\d+)$/, toEn: (m) => `Layer ${m[1]}`, toZh: (m) => `图层 ${m[1]}` },
  { pattern: /^第\s*(\d+)\s*帧$/, toEn: (m) => `Frame ${m[1]}`, toZh: (m) => `第 ${m[1]} 帧` },
  { pattern: /^第\s*(\d+)\s*秒$/, toEn: (m) => `${m[1]}s`, toZh: (m) => `第 ${m[1]} 秒` },
  { pattern: /^未命名工程(?:\s*-\s*场景\s*(\d+))?$/, toEn: (m) => m[1] ? `Untitled Project - Scene ${m[1]}` : 'Untitled Project', toZh: (m) => m[1] ? `未命名工程 - 场景 ${m[1]}` : '未命名工程' },
  { pattern: /^体感手势[：:](.*)$/, toEn: (m) => `Motion gesture: ${m[1]}`, toZh: (m) => `体感手势: ${m[1]}` },
  // 通用标签：「标签（值）」/「标签: 值」——仅当标签已知时才翻译，值原样保留。
  {
    pattern: /^(.+?)[（(]([^()（）]{1,16})[)）]$/,
    toEn: (m) => {
      const label = interfaceTranslations[m[1].trim()];
      return label ? `${label} (${m[2].trim()})` : m[0];
    },
  },
  {
    pattern: /^(.+?)[：:]\s*(.+)$/,
    toEn: (m) => {
      const label = interfaceTranslations[m[1].trim()];
      return label ? `${label}: ${m[2]}` : m[0];
    },
  },
];

const CJK_PATTERN = /[\u4e00-\u9fa5]/;
// 归一化：忽略空白、统一半/全角括号（"未分配分组 (独立图层)" === "未分配分组（独立图层）"）。
const compactKey = (value: string): string => value.replace(/\s+/g, '').replace(/（/g, '(').replace(/）/g, ')');
const compactTranslations = new Map<string, string>();
for (const [source, target] of Object.entries(interfaceTranslations)) {
  compactTranslations.set(compactKey(source), target);
}
// 按长度倒序，优先匹配更长的词组（"画布全屏场景" 先于 "画布场景"）。
const SEGMENT_KEYS = Object.keys(interfaceTranslations)
  .filter((key) => key.length >= 2 && CJK_PATTERN.test(key))
  .sort((a, b) => b.length - a.length);
const segmentCache = new Map<string, string | null>();

/**
 * 翻译「短文本中夹带已知词组」的标签，例如 `🎬 画布场景`。
 * 只有替换后不再残留中文时才采用，避免把未翻译的句子翻成半中半英。
 */
function translateBySegments(input: string): string | null {
  if (input.length > 30 || !CJK_PATTERN.test(input)) return null;
  const cached = segmentCache.get(input);
  if (cached !== undefined) return cached;
  let result = input;
  let changed = false;
  for (const key of SEGMENT_KEYS) {
    if (!result.includes(key)) continue;
    const replacement = interfaceTranslations[key];
    if (!replacement) continue;
    result = result.split(key).join(replacement);
    changed = true;
  }
  const output = changed && !CJK_PATTERN.test(result) ? result : null;
  segmentCache.set(input, output);
  return output;
}

export function translateInterfaceText(text: string, language: AppLanguage): string {
  if (language !== 'en-US') return text;
  const trimmed = text.trim();
  if (interfaceTranslations[trimmed]) return interfaceTranslations[trimmed];
  const compactHit = compactTranslations.get(compactKey(trimmed));
  if (compactHit) return compactHit;
  for (const rule of patternRules) {
    const match = trimmed.match(rule.pattern);
    if (!match) continue;
    const output = rule.toEn(match);
    // 正则产生的候选若仍含中文，说明只翻译了一半，放弃该规则。
    if (!CJK_PATTERN.test(output)) return output;
  }
  const segmented = translateBySegments(trimmed);
  if (segmented) return segmented;
  return text;
}

function getInitialLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'zh-CN';
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved === 'zh-CN' || saved === 'en-US') return saved;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(getInitialLanguage);

  const setLanguage = (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  };

  useEffect(() => {
    document.documentElement.lang = language;

    // Translate exact interface labels rendered by legacy components while keeping
    // user-authored canvas text, project names, and asset names untouched.
    const originalText = new WeakMap<Text, string>();
    const originalAttributes = new WeakMap<Element, Map<string, string>>();
    const reverse = new Map(Object.entries(interfaceTranslations).map(([zh, en]) => [en, zh]));

    const translate = (value: string) => {
      const leading = value.match(/^\s*/)?.[0] ?? '';
      const trailing = value.match(/\s*$/)?.[0] ?? '';
      const trimmed = value.trim();
      if (!trimmed) return value;
      if (language === 'en-US') {
        if (interfaceTranslations[trimmed]) {
          return `${leading}${interfaceTranslations[trimmed]}${trailing}`;
        }
        const compactHit = compactTranslations.get(compactKey(trimmed));
        if (compactHit) return `${leading}${compactHit}${trailing}`;
        for (const rule of patternRules) {
          const match = trimmed.match(rule.pattern);
          if (!match) continue;
          const output = rule.toEn(match);
          if (!CJK_PATTERN.test(output)) return `${leading}${output}${trailing}`;
        }
        const segmented = translateBySegments(trimmed);
        if (segmented) return `${leading}${segmented}${trailing}`;
      } else {
        const zh = reverse.get(trimmed);
        if (zh) return `${leading}${zh}${trailing}`;
      }
      return value;
    };
    const scan = (root: ParentNode) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let current: Node | null;
      while ((current = walker.nextNode())) nodes.push(current as Text);
      nodes.forEach((node) => {
        if (node.parentElement?.closest('script,style,textarea,input,[data-user-content="true"]')) return;
        if (!originalText.has(node)) originalText.set(node, node.nodeValue ?? '');
        node.nodeValue = translate(originalText.get(node) ?? '');
      });
      root.querySelectorAll?.('[title],[aria-label],[placeholder]')?.forEach((element) => {
        const attrs = originalAttributes.get(element) ?? new Map<string, string>();
        ['title', 'aria-label', 'placeholder'].forEach((name) => {
          const value = element.getAttribute(name);
          if (value !== null && !attrs.has(name)) attrs.set(name, value);
          const original = attrs.get(name);
          if (original !== undefined) {
            const translated = translate(original);
            if (element.getAttribute(name) !== translated) element.setAttribute(name, translated);
          }
        });
        originalAttributes.set(element, attrs);
      });
    };
    scan(document.body);
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === 'characterData') {
          const textNode = record.target as Text;
          const current = textNode.nodeValue ?? '';
          const previous = originalText.get(textNode);
          if (previous === current) return;
          const trimmed = current.trim();
          const isKnownTranslation = language === 'en-US' ? reverse.has(trimmed) : Object.values(interfaceTranslations).includes(trimmed);
          if (!isKnownTranslation) originalText.set(textNode, current);
          const translated = translate(originalText.get(textNode) ?? current);
          if (translated !== current) textNode.nodeValue = translated;
          return;
        }
        if (record.type === 'attributes' && record.target instanceof Element) {
          scan(record.target.parentElement ?? record.target);
          return;
        }
        record.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) scan(node as Element);
          else if (node.nodeType === Node.TEXT_NODE) {
            const textNode = node as Text;
            if (!originalText.has(textNode)) originalText.set(textNode, textNode.nodeValue ?? '');
            textNode.nodeValue = translate(originalText.get(textNode) ?? '');
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder'] });
    return () => observer.disconnect();
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key) => messages[language][key],
    translateText: (text) => translateInterfaceText(text, language),
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}

