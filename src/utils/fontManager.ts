/**
 * 字体管理工具模块
 * 提供常用字体列表、系统字体读取、字体检测等功能
 */

export interface FontItem {
  family: string;        // 字体家族名称
  fullName?: string;      // 字体完整名称
  postscriptName?: string; // PostScript名称
  category?: 'serif' | 'sans-serif' | 'monospace' | 'cursive' | 'fantasy' | 'display' | 'handwriting';
  isSystem?: boolean;     // 是否为系统字体
  isCustom?: boolean;     // 是否为用户自定义字体
}

// 常用中文字体列表
export const COMMON_CHINESE_FONTS: FontItem[] = [
  { family: 'SimSun', category: 'serif', isSystem: true },
  { family: 'SimHei', category: 'sans-serif', isSystem: true },
  { family: 'Microsoft YaHei', category: 'sans-serif', isSystem: true },
  { family: 'KaiTi', category: 'serif', isSystem: true },
  { family: 'FangSong', category: 'serif', isSystem: true },
  { family: 'STSong', category: 'serif', isSystem: true },
  { family: 'STHeiti', category: 'sans-serif', isSystem: true },
  { family: 'STKaiti', category: 'serif', isSystem: true },
  { family: 'STFangsong', category: 'serif', isSystem: true },
  { family: 'PingFang SC', category: 'sans-serif', isSystem: true },
  { family: 'Hiragino Sans GB', category: 'sans-serif', isSystem: true },
  { family: 'Noto Sans SC', category: 'sans-serif', isSystem: true },
  { family: 'Noto Serif SC', category: 'serif', isSystem: true },
  { family: 'Source Han Sans CN', category: 'sans-serif', isSystem: true },
  { family: 'Source Han Serif CN', category: 'serif', isSystem: true },
];

// 常用英文字体列表
export const COMMON_ENGLISH_FONTS: FontItem[] = [
  { family: 'Arial', category: 'sans-serif', isSystem: true },
  { family: 'Arial Black', category: 'sans-serif', isSystem: true },
  { family: 'Helvetica', category: 'sans-serif', isSystem: true },
  { family: 'Helvetica Neue', category: 'sans-serif', isSystem: true },
  { family: 'Times New Roman', category: 'serif', isSystem: true },
  { family: 'Times', category: 'serif', isSystem: true },
  { family: 'Courier New', category: 'monospace', isSystem: true },
  { family: 'Courier', category: 'monospace', isSystem: true },
  { family: 'Verdana', category: 'sans-serif', isSystem: true },
  { family: 'Georgia', category: 'serif', isSystem: true },
  { family: 'Palatino', category: 'serif', isSystem: true },
  { family: 'Garamond', category: 'serif', isSystem: true },
  { family: 'Bookman', category: 'serif', isSystem: true },
  { family: 'Comic Sans MS', category: 'cursive', isSystem: true },
  { family: 'Trebuchet MS', category: 'sans-serif', isSystem: true },
  { family: 'Impact', category: 'sans-serif', isSystem: true },
  { family: 'Tahoma', category: 'sans-serif', isSystem: true },
  { family: 'Lucida Console', category: 'monospace', isSystem: true },
  { family: 'Lucida Sans Unicode', category: 'sans-serif', isSystem: true },
  { family: 'Copperplate', category: 'fantasy', isSystem: true },
  { family: 'Brush Script MT', category: 'cursive', isSystem: true },
];

// 设计感字体（需要用户自行安装或通过Web Font加载）
export const DESIGN_FONTS: FontItem[] = [
  { family: 'Roboto', category: 'sans-serif' },
  { family: 'Open Sans', category: 'sans-serif' },
  { family: 'Lato', category: 'sans-serif' },
  { family: 'Montserrat', category: 'sans-serif' },
  { family: 'Poppins', category: 'sans-serif' },
  { family: 'Inter', category: 'sans-serif' },
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Merriweather', category: 'serif' },
  { family: 'Lora', category: 'serif' },
  { family: 'Oswald', category: 'sans-serif' },
  { family: 'Raleway', category: 'sans-serif' },
  { family: 'Ubuntu', category: 'sans-serif' },
  { family: 'Nunito', category: 'sans-serif' },
  { family: 'Muli', category: 'sans-serif' },
  { family: 'Quicksand', category: 'sans-serif' },
  { family: 'Fjalla One', category: 'sans-serif' },
  { family: 'Bebas Neue', category: 'sans-serif' },
  { family: 'Anton', category: 'sans-serif' },
  { family: 'Pacifico', category: 'cursive' },
  { family: 'Dancing Script', category: 'cursive' },
  { family: 'Great Vibes', category: 'cursive' },
  { family: 'Satisfy', category: 'cursive' },
  { family: 'Lobster', category: 'cursive' },
  { family: 'Righteous', category: 'cursive' },
  { family: 'Orbitron', category: 'sans-serif' },
  { family: 'Russo One', category: 'sans-serif' },
  { family: 'Audiowide', category: 'sans-serif' },
  { family: 'Press Start 2P', category: 'monospace' },
  { family: 'Source Code Pro', category: 'monospace' },
  { family: 'Fira Code', category: 'monospace' },
  { family: 'JetBrains Mono', category: 'monospace' },
];

// 默认字体回退栈
export const FONT_FALLBACKS: Record<string, string> = {
  'serif': 'Georgia, "Times New Roman", Times, serif',
  'sans-serif': '"Helvetica Neue", Helvetica, Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
  'monospace': '"Courier New", Courier, monospace',
  'cursive': '"Comic Sans MS", cursive',
  'fantasy': 'Impact, fantasy',
};

/**
 * 检测浏览器是否支持 queryLocalFonts API
 */
export function isLocalFontsAPISupported(): boolean {
  return typeof window !== 'undefined' && 'queryLocalFonts' in window;
}

const LOCAL_FONT_QUERY_TIMEOUT_MS = 8000;

/**
 * 读取用户电脑安装的所有字体
 * 需要用户授权，仅在 Chrome 103+ / Edge 中支持
 */
export async function queryLocalFonts(): Promise<FontItem[]> {
  if (!isLocalFontsAPISupported()) {
    throw new Error('当前浏览器不支持读取系统字体 API，请使用 Chrome 103+ 或 Edge 浏览器');
  }

  try {
    const localFontsApi = window as unknown as { queryLocalFonts: () => Promise<any[]> };
    const fonts = await Promise.race([
      localFontsApi.queryLocalFonts(),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('读取系统字体超时，请检查浏览器字体访问权限后重试')), LOCAL_FONT_QUERY_TIMEOUT_MS);
      }),
    ]);
    return fonts.map((f: any) => ({
      family: f.family,
      fullName: f.fullName,
      postscriptName: f.postscriptName,
      isSystem: true,
    }));
  } catch (error: any) {
    if (error.name === 'NotAllowedError') {
      throw new Error('用户拒绝了字体访问权限，请在浏览器设置中允许字体访问');
    }
    throw error;
  }
}

/**
 * 检测指定字体是否在用户系统中可用
 * 使用 Canvas 测量的方式检测字体是否存在
 */
export function detectFontAvailability(fontFamily: string): boolean {
  if (typeof document === 'undefined') return false;

  const testString = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const testSize = '72px';

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return false;

  const getWidth = (font: string): number => {
    context.font = `${testSize} ${font}`;
    return context.measureText(testString).width;
  };

  const baseWidths = baseFonts.map(getWidth);
  const testWidth = getWidth(`"${fontFamily}", ${baseFonts.join(',')}`);

  // 如果测试字体的宽度与所有基础字体的宽度都不同，说明字体存在
  return !baseWidths.some((w) => Math.abs(w - testWidth) < 0.5);
}

/**
 * 获取字体的CSS font-family值（包含回退字体）
 */
export function getFontFamilyCSS(fontFamily: string, category?: string): string {
  const fallback = category ? FONT_FALLBACKS[category] : FONT_FALLBACKS['sans-serif'];
  return `"${fontFamily}", ${fallback}`;
}

/**
 * 按分类分组字体列表
 */
export function groupFontsByCategory(fonts: FontItem[]): Record<string, FontItem[]> {
  const groups: Record<string, FontItem[]> = {};
  fonts.forEach((font) => {
    const cat = font.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(font);
  });
  return groups;
}

/**
 * 搜索字体列表
 */
export function searchFonts(fonts: FontItem[], keyword: string): FontItem[] {
  const lowerKeyword = keyword.toLowerCase().trim();
  if (!lowerKeyword) return fonts;
  return fonts.filter((f) =>
    f.family.toLowerCase().includes(lowerKeyword) ||
    f.fullName?.toLowerCase().includes(lowerKeyword) ||
    f.postscriptName?.toLowerCase().includes(lowerKeyword)
  );
}

/**
 * 字体分类中文名称映射
 */
export const CATEGORY_NAMES: Record<string, string> = {
  'serif': '衬线体',
  'sans-serif': '无衬线体',
  'monospace': '等宽体',
  'cursive': '手写体',
  'fantasy': '装饰体',
  'display': '展示体',
  'handwriting': '手写体',
  'other': '其他',
};
