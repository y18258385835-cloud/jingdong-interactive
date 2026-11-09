export type NewsItem = { id: string; title: string; date: string; summary: string; content: string };
export type WebsiteContent = {
  logoText: string; eyebrow: string; title: string; titleAccent: string; subtitle: string;
  downloadLabel: string; downloadUrl: string; licenseUrl: string; news: NewsItem[];
};

export const defaultWebsiteContent: WebsiteContent = {
  logoText: '鲸动交互', eyebrow: '鲸动交互平台 / 2026', title: '把想法做成', titleAccent: '可交互的作品',
  subtitle: '面向创作者与团队的沉浸式交互创作工具，让每一次表达都更有回应。',
  downloadLabel: '立即下载', downloadUrl: '', licenseUrl: '',
  news: [
    { id: 'welcome', title: '鲸动交互平台正式上线', date: '2026.09.25', summary: '新一代交互内容工作台，支持实时预览与专业导出。', content: '鲸动交互平台现已开放下载，欢迎使用。' },
    { id: 'license', title: '注册码与授权说明', date: '2026.09.20', summary: '购买授权后，可在平台内完成设备激活与状态查看。', content: '注册码由平台后台生成和管理。' },
  ],
};

const STORAGE_KEY = 'jingdong_website_content_v1';
export function loadWebsiteContent(): WebsiteContent {
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); if (value?.news) return value; } catch { /* ignore malformed local content */ }
  return defaultWebsiteContent;
}
export function saveWebsiteContent(content: WebsiteContent) { localStorage.setItem(STORAGE_KEY, JSON.stringify(content)); }
