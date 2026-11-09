export type HarnessAttachmentCategory = 'image' | 'video' | 'audio' | 'model' | 'project' | 'document';
export type HarnessAttachmentStatus = 'ready' | 'reading' | 'unsupported' | 'too-large' | 'needs-reselect';

export interface HarnessAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  category: HarnessAttachmentCategory;
  previewUrl?: string;
  dataUrl?: string;
  textContent?: string;
  status: HarnessAttachmentStatus;
  statusMessage?: string;
}

export const MAX_HARNESS_ATTACHMENTS = 12;
export const MAX_HARNESS_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_HARNESS_IMAGE_BYTES = 6 * 1024 * 1024;
export const MAX_HARNESS_TEXT_CHARS = 120_000;

const MODEL_EXTENSIONS = new Set(['glb', 'gltf', 'obj', 'fbx', 'stl', '3mf', 'dae', 'ply', 'splat', 'ksplat']);
const PROJECT_EXTENSIONS = new Set(['aether', 'zip']);
const DOCUMENT_EXTENSIONS = new Set(['txt', 'md', 'csv', 'json', 'html', 'htm', 'xml']);

function extensionOf(name: string) {
  return name.split('.').pop()?.toLowerCase() || '';
}

export function getHarnessAttachmentCategory(file: Pick<File, 'name' | 'type'>): HarnessAttachmentCategory | null {
  const mime = file.type.toLowerCase();
  const extension = extensionOf(file.name);
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (MODEL_EXTENSIONS.has(extension) || mime.startsWith('model/')) return 'model';
  if (PROJECT_EXTENSIONS.has(extension) || mime === 'application/zip' || mime === 'application/x-zip-compressed') return 'project';
  if (DOCUMENT_EXTENSIONS.has(extension) || mime.startsWith('text/') || mime === 'application/json') return 'document';
  return null;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('文本文件读取失败'));
    reader.onload = () => resolve(String(reader.result || '').slice(0, MAX_HARNESS_TEXT_CHARS));
    reader.readAsText(file);
  });
}

function createAttachmentId(file: File) {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `attachment_${suffix}_${file.name}`;
}

/** Read only payloads the model can use directly; large media stays local as metadata. */
export async function readHarnessAttachment(file: File): Promise<HarnessAttachment> {
  const base: HarnessAttachment = {
    id: createAttachmentId(file),
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    category: getHarnessAttachmentCategory(file) || 'document',
    status: 'reading',
  };
  const category = getHarnessAttachmentCategory(file);
  if (!category) return { ...base, status: 'unsupported', statusMessage: '当前软件未声明支持此文件类型' };
  if (file.size > MAX_HARNESS_FILE_BYTES) return { ...base, category, status: 'too-large', statusMessage: '单个文件不能超过 25 MB' };

  try {
    if (category === 'image') {
      if (file.size > MAX_HARNESS_IMAGE_BYTES) return { ...base, category, status: 'too-large', statusMessage: '图片超过 6 MB，无法作为视觉上下文发送' };
      const previewUrl = URL.createObjectURL(file);
      const visualMime = /^(image\/(?:png|jpe?g|webp|gif))$/i.test(file.type);
      return {
        ...base,
        category,
        dataUrl: visualMime ? await readAsDataUrl(file) : undefined,
        previewUrl,
        status: 'ready',
        statusMessage: visualMime ? undefined : '已挂载图片；当前请求只发送文件信息',
      };
    }
    if (category === 'document') {
      return { ...base, category, textContent: await readAsText(file), status: 'ready' };
    }
    return { ...base, category, previewUrl: URL.createObjectURL(file), status: 'ready' };
  } catch (error) {
    return { ...base, category, status: 'unsupported', statusMessage: error instanceof Error ? error.message : '文件读取失败' };
  }
}

/** Clipboard APIs expose files either directly or through clipboard items depending on the browser/source. */
export function getClipboardFiles(clipboard: Pick<DataTransfer, 'files' | 'items'>) {
  const directFiles = Array.from(clipboard.files || []);
  if (directFiles.length) return directFiles;
  return Array.from(clipboard.items || [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

export function serializeHarnessAttachments(attachments: HarnessAttachment[]) {
  return attachments.filter((attachment) => attachment.status === 'ready').slice(0, MAX_HARNESS_ATTACHMENTS).map((attachment) => ({
    name: attachment.name,
    type: attachment.type,
    category: attachment.category,
    size: attachment.size,
    dataUrl: attachment.dataUrl,
    textContent: attachment.textContent,
  }));
}

export function formatHarnessAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
