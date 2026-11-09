// 把 LanguageContext 里的内联翻译表迁移到独立语言包文件。
import fs from 'node:fs';

const file = 'src/i18n/LanguageContext.tsx';
let source = fs.readFileSync(file, 'utf8');

const startMarker = 'export const interfaceTranslations: Record<string, string> = {';
const start = source.indexOf(startMarker);
if (start < 0) {
  console.error('未找到 interfaceTranslations 定义');
  process.exit(1);
}
const end = source.indexOf('\n};', start);
if (end < 0) {
  console.error('未找到 interfaceTranslations 结束位置');
  process.exit(1);
}

const body = source.slice(start + startMarker.length, end);
fs.mkdirSync('src/i18n/locales', { recursive: true });
const localeFile = `/**
 * 英文界面文案（key 为中文原文）。
 *
 * 由 tools/migrate-i18n.mjs 从 LanguageContext 的内联表迁移而来；
 * 后续新增文案请直接在这里补，或改用 t('key') 资源键。
 */
export const EN_US_INTERFACE: Record<string, string> = {${body}
};
`;
fs.writeFileSync('src/i18n/locales/en-US.ts', localeFile, 'utf8');

const replacement = `import { EN_US_INTERFACE } from './locales/en-US';

/** 兼容旧导出：中文原文 → 英文文案。 */
export const interfaceTranslations: Record<string, string> = EN_US_INTERFACE;`;
source = source.slice(0, start) + replacement + source.slice(end + 3);
fs.writeFileSync(file, source, 'utf8');

console.log('已迁移到 src/i18n/locales/en-US.ts');
