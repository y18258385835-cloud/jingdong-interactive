import type { CustomCodePlugin } from '../types';
import { splitCustomCodeDocument } from './customCode';
import attachmentSource from '../assets/dashboard-embedded-components.html?raw';

const EMBEDDED_COMPONENT_NAMES = [
  '数据趋势',
  '数据趋势 · 科幻图表',
  '数据趋势 · 面积图',
  '数据趋势 · 双曲线面积图',
  '数据趋势 · 赛博发光气泡图',
  '数据趋势 · 赛博发光圆环图',
  '数据趋势 · 赛博发光圆环图（多环版本）',
  '数据趋势 · 赛博 HUD 仪表盘',
  '数据趋势 · 赛博雷达图',
  '数据趋势 · 赛博3D环形图',
  '数据分布统计',
] as const;

const splitAttachedDocuments = (source: string) => source
  .split(/(?=<!DOCTYPE html>)/i)
  .map((document) => document.trim())
  .filter(Boolean);

const createEmbeddedPlugin = (source: string, index: number, name: string): CustomCodePlugin => {
  const parsed = splitCustomCodeDocument(source);
  const timestamp = '2026-09-20T00:00:00.000Z';
  return {
    id: `dashboard-embedded-${index + 1}`,
    version: 1,
    name,
    description: '附件内置仪表盘组件',
    html: parsed.html,
    css: parsed.css,
    js: parsed.js,
    preview: { mode: 'responsive', background: 'transparent' },
    diagnostics: { status: 'passed', errors: [], warnings: [], checkedAt: timestamp },
    exportTarget: { category: 'shapes', slot: 'dashboard' },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const attachedDocuments = splitAttachedDocuments(attachmentSource);

export const EMBEDDED_DASHBOARD_COMPONENTS: CustomCodePlugin[] = EMBEDDED_COMPONENT_NAMES
  .map((name, index) => attachedDocuments[index] ? createEmbeddedPlugin(attachedDocuments[index], index, name) : null)
  .filter((plugin): plugin is CustomCodePlugin => Boolean(plugin));
