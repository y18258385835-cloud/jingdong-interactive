import { describe, expect, it } from 'vitest';
import { hasExternalGltfDependencies } from '../src/utils/gltfDependencies';

function gltfFile(name: string, document: unknown): File {
  return new File([JSON.stringify(document)], name, { type: 'model/gltf+json' });
}

describe('glTF upload dependency detection', () => {
  it('allows self-contained data URIs', async () => {
    const file = gltfFile('inline.gltf', {
      buffers: [{ uri: 'data:application/octet-stream;base64,AA==' }],
      images: [{ uri: 'data:image/png;base64,AA==' }],
    });
    await expect(hasExternalGltfDependencies(file)).resolves.toBe(false);
  });

  it('detects external buffers and textures that cannot be resolved by a single-file upload', async () => {
    const file = gltfFile('model.gltf', {
      buffers: [{ uri: 'model.bin' }],
      images: [{ uri: 'textures/albedo.png' }],
    });
    await expect(hasExternalGltfDependencies(file)).resolves.toBe(true);
  });

  it('does not inspect self-contained GLB uploads', async () => {
    const file = gltfFile('model.glb', { buffers: [{ uri: 'model.bin' }] });
    await expect(hasExternalGltfDependencies(file)).resolves.toBe(false);
  });
});
