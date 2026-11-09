import type { ProjectData, SceneElement, Hotspot } from '../../types';
import type { AssetRecord } from '../db/types';

export type ProjectHealthIssueCode = 'missing-asset' | 'missing-scene' | 'invalid-reference';
export interface ProjectHealthIssue { code: ProjectHealthIssueCode; message: string; sceneId?: string; elementId?: string; reference?: string; repair?: 'remove-reference' | 'choose-asset' | 'choose-scene'; }
export interface ProjectHealthReport { ok: boolean; issues: ProjectHealthIssue[]; missingAssetIds: string[]; missingSceneIds: string[]; }

const isExternalReference = (value: string) => /^(data:|blob:|https?:\/\/|\/|\.\/|\.\.\/)/i.test(value);
function addAssetRef(value: unknown, context: { sceneId: string; elementId?: string }, assets: Set<string>, issues: ProjectHealthIssue[]): void {
  if (typeof value !== 'string' || !value.trim() || isExternalReference(value) || assets.has(value)) return;
  issues.push({ ...context, code: 'missing-asset', reference: value, repair: 'choose-asset', message: `资源“${value}”不存在或已被删除` });
}
function scanElement(element: SceneElement, sceneId: string, assets: Set<string>, issues: ProjectHealthIssue[]): void {
  addAssetRef(element.refId, { sceneId, elementId: element.id }, assets, issues);
  if (element.interaction?.action === 'media') addAssetRef(element.interaction.mediaRefId, { sceneId, elementId: element.id }, assets, issues);
  for (const child of element.children || []) scanElement(child, sceneId, assets, issues);
}
function scanHotspot(hotspot: Hotspot, sceneId: string, assets: Set<string>, issues: ProjectHealthIssue[]): void {
  addAssetRef(hotspot.mediaRefId, { sceneId, elementId: hotspot.id }, assets, issues);
  addAssetRef(hotspot.iconImageRefId, { sceneId, elementId: hotspot.id }, assets, issues);
  addAssetRef(hotspot.iconVideoRefId, { sceneId, elementId: hotspot.id }, assets, issues);
  addAssetRef(hotspot.iconModelRefId, { sceneId, elementId: hotspot.id }, assets, issues);
  if (hotspot.interaction?.action === 'media') addAssetRef(hotspot.interaction.mediaRefId, { sceneId, elementId: hotspot.id }, assets, issues);
}

export function scanProjectHealth(project: ProjectData, assetRecords: AssetRecord[] | Map<string, AssetRecord> | Set<string> = []): ProjectHealthReport {
  const assets = assetRecords instanceof Set ? assetRecords : new Set(assetRecords instanceof Map ? Array.from(assetRecords.keys()) : assetRecords.map((asset) => asset.id));
  const sceneIds = new Set(Object.keys(project?.scenes || {}));
  const issues: ProjectHealthIssue[] = [];
  for (const [sceneId, scene] of Object.entries(project?.scenes || {})) {
    addAssetRef(scene.bgRef, { sceneId }, assets, issues);
    addAssetRef(scene.bgmRef, { sceneId }, assets, issues);
    for (const element of scene.els || []) {
      scanElement(element, sceneId, assets, issues);
      for (const hotspot of ((element as SceneElement & { hotspots?: Hotspot[] }).hotspots || [])) scanHotspot(hotspot, sceneId, assets, issues);
    }
    for (const element of scene.els || []) {
      if (element.linkType === 'jump' && element.link && !sceneIds.has(element.link)) issues.push({ code: 'missing-scene', sceneId, elementId: element.id, reference: element.link, repair: 'choose-scene', message: `跳转目标场景“${element.link}”不存在` });
      if (element.interaction?.action === 'jump' && element.interaction.target && !sceneIds.has(element.interaction.target)) issues.push({ code: 'missing-scene', sceneId, elementId: element.id, reference: element.interaction.target, repair: 'choose-scene', message: `交互目标场景“${element.interaction.target}”不存在` });
    }
  }
  const missingAssetIds = Array.from(new Set(issues.filter((issue) => issue.code === 'missing-asset').map((issue) => issue.reference!)));
  const missingSceneIds = Array.from(new Set(issues.filter((issue) => issue.code === 'missing-scene').map((issue) => issue.reference!)));
  return { ok: issues.length === 0, issues, missingAssetIds, missingSceneIds };
}

export function repairProjectReferences(project: ProjectData, report: ProjectHealthReport): ProjectData {
  const missing = new Set(report.issues.filter((issue) => issue.code === 'missing-asset').map((issue) => `${issue.sceneId}:${issue.elementId || ''}:${issue.reference}`));
  const next = structuredClone(project) as ProjectData;
  for (const [sceneId, scene] of Object.entries(next.scenes || {})) {
    if (missing.has(`${sceneId}::${scene.bgRef}`)) scene.bgRef = undefined;
    if (missing.has(`${sceneId}::${scene.bgmRef}`)) scene.bgmRef = undefined;
    for (const element of scene.els || []) {
      if (missing.has(`${sceneId}:${element.id}:${element.refId}`)) element.refId = '';
      if (element.interaction?.mediaRefId && missing.has(`${sceneId}:${element.id}:${element.interaction.mediaRefId}`)) element.interaction.mediaRefId = undefined;
    }
  }
  return next;
}
