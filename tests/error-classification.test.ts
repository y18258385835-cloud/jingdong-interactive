import { describe, expect, it } from 'vitest';
import { isDynamicModuleLoadError } from '../src/utils/errorClassification';

describe('error classification', () => {
  it('recognizes dynamic module failures from Chrome, Firefox, Safari and webpack', () => {
    expect(isDynamicModuleLoadError(new TypeError('Failed to fetch dynamically imported module: http://127.0.0.1:3000/src/components/VfxMotionCanvas.tsx'))).toBe(true);
    expect(isDynamicModuleLoadError(new Error('error loading dynamically imported module'))).toBe(true);
    expect(isDynamicModuleLoadError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isDynamicModuleLoadError(new Error('ChunkLoadError: Loading chunk 12 failed.'))).toBe(true);
    expect(isDynamicModuleLoadError(new Error('Unable to preload CSS for /assets/app.css'))).toBe(true);
  });

  it('does not classify ordinary render errors as module failures', () => {
    expect(isDynamicModuleLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isDynamicModuleLoadError(new Error('Maximum update depth exceeded'))).toBe(false);
    expect(isDynamicModuleLoadError(null)).toBe(false);
    expect(isDynamicModuleLoadError(undefined)).toBe(false);
    expect(isDynamicModuleLoadError('plain string error')).toBe(false);
  });
});
