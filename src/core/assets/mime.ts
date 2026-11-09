/**
 * ZIP entries preserve bytes, but not the browser MIME information needed by
 * media elements. Keep type recovery in one place for import, playback and
 * re-export so a valid MP4 cannot turn into an image on a later round-trip.
 */

const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml',
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac', flac: 'audio/flac', m4a: 'audio/mp4',
  glb: 'model/gltf-binary', gltf: 'model/gltf+json', ply: 'application/x-ply',
  ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
};

export function inferMimeTypeFromFileName(fileName: string): string {
  const cleanName = fileName.split(/[?#]/, 1)[0];
  const extension = cleanName.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_MIME_TYPES[extension] || 'application/octet-stream';
}

export function isSpecificMimeType(mimeType: string | undefined | null): mimeType is string {
  return Boolean(mimeType)
    && mimeType !== 'application/octet-stream'
    && mimeType !== 'application/zip'
    && mimeType !== 'binary/octet-stream';
}

/** Detect common browser media formats from bytes when a historical archive lost its MIME. */
export async function sniffMimeType(blob: Blob): Promise<string | undefined> {
  const bytes = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  const has = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const textAt = (offset: number, length: number) => String.fromCharCode(...bytes.slice(offset, offset + length));

  if (has(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (has(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (textAt(0, 6) === 'GIF87a' || textAt(0, 6) === 'GIF89a') return 'image/gif';
  if (textAt(0, 4) === 'RIFF' && textAt(8, 4) === 'WEBP') return 'image/webp';
  if (textAt(0, 4) === 'RIFF' && textAt(8, 4) === 'WAVE') return 'audio/wav';
  if (textAt(4, 4) === 'ftyp') return 'video/mp4';
  if (has(0x1a, 0x45, 0xdf, 0xa3)) return 'video/webm';
  if (textAt(0, 4) === 'OggS') return 'audio/ogg';
  if (textAt(0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (textAt(0, 4) === 'glTF') return 'model/gltf-binary';
  if (textAt(0, 3).toLowerCase() === 'ply') return 'application/x-ply';
  return undefined;
}

/**
 * Prefer byte signatures over stale metadata. This repairs old ZIPs where a
 * video was previously written with a .png path after its Blob type was lost.
 */
export async function resolveMediaMimeType(blob: Blob, ...candidates: Array<string | undefined>): Promise<string> {
  const detected = await sniffMimeType(blob);
  if (detected) return detected;
  for (const candidate of candidates) {
    if (isSpecificMimeType(candidate)) return candidate;
  }
  return 'application/octet-stream';
}

export async function withResolvedMediaMimeType(blob: Blob, ...candidates: Array<string | undefined>): Promise<Blob> {
  const mimeType = await resolveMediaMimeType(blob, ...candidates);
  if (blob.type.toLowerCase() === mimeType.toLowerCase()) return blob;
  return new Blob([await blob.arrayBuffer()], { type: mimeType });
}
