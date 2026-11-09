import { describe, expect, it } from 'vitest';
import type { ProjectData } from '../src/types';
import { generateStandaloneHTML } from '../src/utils/export';
import { computePopupGeometry, getStandalonePopupGeometryRuntime } from '../src/utils/popups';

describe('standalone popup layout', () => {
  it('preserves media sizing, zero opacity, rotation and one-shot video semantics', () => {
    const project = {
      meta: { v: 1 }, start: 'main', scenes: {
        main: {
          id: 'main', alias: 'Main', type: 'scene', duration: 5, inPoint: 0, outPoint: 5, els: [
            { id: 'image', type: 'img', refId: 'data:image/png;base64,AA==', x: 0, y: 0, w: 10, h: 10, rot: 18, zIndex: 1, opacity: 0, startTime: 0, duration: 5 },
            { id: 'video', type: 'vid', refId: 'data:video/mp4;base64,AA==', x: 10, y: 0, w: 10, h: 10, zIndex: 2, opacity: 100, startTime: 0, duration: 5 },
          ],
        },
      },
    } as unknown as ProjectData;
    const html = generateStandaloneHTML(project);

    expect(html).toContain('object-fit: contain');
    expect(html).toContain("(el.opacity !== undefined ? el.opacity : 100) / 100");
    expect(html).toContain("video.loop = el.playbackInfinite === true || el.loop === 'true'");
    expect(html).not.toContain('.element.interactive:hover { transform: scale(1.03)');
  });

  it('serializes the editor geometry function without a divergent runtime copy', () => {
    const runtime = new Function(`${getStandalonePopupGeometryRuntime()} return computePopupGeometry;`)() as typeof computePopupGeometry;
    const popup = {
      popupPosition: 'custom' as const,
      popupSize: 'custom' as const,
      popupX: 50,
      popupY: 50,
      popupWidth: 72,
      popupRatio: '16:9' as const,
    };
    const stage = { left: 80, top: 120, width: 1200, height: 675 };

    expect(runtime(popup, 'modal', stage)).toEqual(computePopupGeometry(popup, 'modal', stage));
  });

  it('contains a fixed-size authored canvas inside the exported popup', () => {
    const project = {
      meta: { v: 1, title: 'Popup parity' },
      start: 'main',
      canvas: { width: 1920, height: 1080 },
      scenes: {
        main: {
          id: 'main', alias: 'Main', type: 'scene', duration: 10, inPoint: 0, outPoint: 10,
          bgColor: '#101010', els: [{
            id: 'trigger', type: 'shape', x: 10, y: 10, w: 20, h: 12, zIndex: 1, opacity: 100,
            startTime: 0, duration: 10, popupPosition: 'custom', popupSize: 'custom', popupX: 50, popupY: 50,
            popupWidth: 72, popupRatio: '16:9', interaction: { trigger: 'click', action: 'popup', target: 'popup' },
          }],
        },
        popup: {
          id: 'popup', alias: 'Popup', type: 'modal', duration: 10, inPoint: 0, outPoint: 10,
          bgColor: '#152238', els: [{
            id: 'headline', type: 'txt', content: 'Keep authored proportions', x: 12, y: 20, w: 76, h: 20,
            zIndex: 1, opacity: 100, startTime: 0, duration: 10, fontSize: 72,
          }],
        },
      },
    } as unknown as ProjectData;

    const html = generateStandaloneHTML(project);

    expect(html).toContain('const __name = (value) => value; const computePopupGeometry = function computePopupGeometry');
    expect(html).toContain("className = 'popup-scene-content'");
    expect(html).toContain("width:' + canvasWidth + 'px;height:' + canvasHeight + 'px");
    expect(html).toContain("scale(' + Math.max(0, scale) + ')");
  });
});
