/** True when a standalone glTF document refers to files outside the document. */
export async function hasExternalGltfDependencies(file: File): Promise<boolean> {
  if (!file.name.toLowerCase().endsWith('.gltf')) return false;
  try {
    const document = JSON.parse(await file.text()) as {
      buffers?: Array<{ uri?: unknown }>;
      images?: Array<{ uri?: unknown }>;
    };
    return [...(document.buffers || []), ...(document.images || [])].some(({ uri }) => (
      typeof uri === 'string' && !/^(data:|blob:)/i.test(uri)
    ));
  } catch {
    // Keep malformed files importable so GLTFLoader can return its detailed parse error.
    return false;
  }
}
