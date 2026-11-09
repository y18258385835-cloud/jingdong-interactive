import type { ProjectData } from '../../types';

const ASSET_REFERENCE_KEYS = new Set([
  'bgRef', 'bgmRef', 'refId', 'mediaRefId', 'assetRefId',
  'iconImageRefId', 'iconVideoRefId', 'iconModelRefId', 'assetRef',
]);

function visitProjectAssetReferences(
  value: unknown,
  visit: (owner: Record<string, unknown>, key: string, reference: string) => void,
): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => visitProjectAssetReferences(item, visit));
    return;
  }

  const owner = value as Record<string, unknown>;
  for (const [key, childValue] of Object.entries(owner)) {
    if (typeof childValue === 'string' && ASSET_REFERENCE_KEYS.has(key) && childValue.trim()) {
      visit(owner, key, childValue);
      continue;
    }
    visitProjectAssetReferences(childValue, visit);
  }
}

/** Collect every persisted reference that can affect project playback. */
export function collectProjectAssetReferences(project: ProjectData): Set<string> {
  const refs = new Set<string>();
  visitProjectAssetReferences(project, (_owner, _key, reference) => refs.add(reference));
  return refs;
}

/** Rewrites only asset-reference fields, never ordinary text or scene IDs. */
export function replaceProjectAssetReferences(
  project: ProjectData,
  replacements: ReadonlyMap<string, string>,
): ProjectData {
  visitProjectAssetReferences(project, (owner, key, reference) => {
    const replacement = replacements.get(reference);
    if (replacement !== undefined) owner[key] = replacement;
  });
  return project;
}

export function isPackagedAssetReference(reference: string): boolean {
  return !/^(data:|blob:|https?:\/\/)/i.test(reference);
}

/** Returns local references that cannot be satisfied after an import. */
export function collectUnresolvedPackagedAssetReferences(
  project: ProjectData,
  availableReferences: ReadonlySet<string>,
): string[] {
  return Array.from(collectProjectAssetReferences(project))
    .filter((reference) => isPackagedAssetReference(reference) && !availableReferences.has(reference))
    .sort();
}
