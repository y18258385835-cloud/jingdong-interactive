import { describe, expect, it } from 'vitest';
import { getClipboardFiles, getHarnessAttachmentCategory, serializeHarnessAttachments } from '../src/core/ai/harnessAttachments';

describe('Harness attachment intake', () => {
  it('recognizes every editor-supported attachment family', () => {
    expect(getHarnessAttachmentCategory({ name: 'reference.png', type: 'image/png' })).toBe('image');
    expect(getHarnessAttachmentCategory({ name: 'demo.mp4', type: 'video/mp4' })).toBe('video');
    expect(getHarnessAttachmentCategory({ name: 'voice.wav', type: 'audio/wav' })).toBe('audio');
    expect(getHarnessAttachmentCategory({ name: 'model.glb', type: 'model/gltf-binary' })).toBe('model');
    expect(getHarnessAttachmentCategory({ name: 'project.aether', type: 'application/octet-stream' })).toBe('project');
    expect(getHarnessAttachmentCategory({ name: 'brief.json', type: 'application/json' })).toBe('document');
    expect(getHarnessAttachmentCategory({ name: 'binary.exe', type: 'application/octet-stream' })).toBeNull();
  });

  it('serializes only ready files and omits preview-only object URLs', () => {
    expect(serializeHarnessAttachments([
      { id: '1', name: 'image.png', type: 'image/png', size: 100, category: 'image', dataUrl: 'data:image/png;base64,AA==', previewUrl: 'blob:preview', status: 'ready' },
      { id: '2', name: 'video.mp4', type: 'video/mp4', size: 100, category: 'video', previewUrl: 'blob:video', status: 'ready' },
      { id: '3', name: 'bad.exe', type: 'application/octet-stream', size: 100, category: 'document', status: 'unsupported' },
    ])).toEqual([
      { name: 'image.png', type: 'image/png', category: 'image', size: 100, dataUrl: 'data:image/png;base64,AA==', textContent: undefined },
      { name: 'video.mp4', type: 'video/mp4', category: 'video', size: 100, dataUrl: undefined, textContent: undefined },
    ]);
  });

  it('extracts files from direct clipboard data or clipboard items', () => {
    const image = new File(['image'], 'pasted.png', { type: 'image/png' });
    expect(getClipboardFiles({ files: [image] as unknown as FileList, items: [] as unknown as DataTransferItemList })).toEqual([image]);
    const item = { kind: 'file', getAsFile: () => image } as unknown as DataTransferItem;
    expect(getClipboardFiles({ files: [] as unknown as FileList, items: [item] as unknown as DataTransferItemList })).toEqual([image]);
  });
});
