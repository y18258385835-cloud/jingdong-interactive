import { beforeEach, describe, expect, it, vi } from 'vitest';
import html2canvas from 'html2canvas-pro';
import { captureElement, getExportCaptureTarget } from '../src/utils/canvasCapture';

vi.mock('html2canvas-pro', () => ({ default: vi.fn() }));

describe('advanced export capture target', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('captures the authored stage instead of surrounding editor chrome', () => {
    const stage = {} as HTMLElement;
    const container = { querySelector: vi.fn(() => stage) } as unknown as HTMLElement;

    expect(getExportCaptureTarget(container)).toBe(stage);
    expect(container.querySelector).toHaveBeenCalledWith('[data-export-stage="true"]');
  });

  it('falls back to the supplied container for legacy canvases without a stage marker', () => {
    const container = { querySelector: vi.fn(() => null) } as unknown as HTMLElement;
    expect(getExportCaptureTarget(container)).toBe(container);
  });

  it('skips synchronous PNG serialization for video frames', async () => {
    const canvas = {
      width: 1280,
      height: 720,
      toDataURL: vi.fn(() => 'data:image/png;base64,unused'),
    } as unknown as HTMLCanvasElement;
    vi.mocked(html2canvas).mockResolvedValue(canvas);

    const result = await captureElement({ offsetWidth: 640, offsetHeight: 360 } as HTMLElement, {
      mutateSource: false,
      includeDataUrl: false,
    });

    expect(result.dataUrl).toBe('');
    expect(canvas.toDataURL).not.toHaveBeenCalled();
  });

  it('keeps PNG serialization enabled for image captures by default', async () => {
    const canvas = {
      width: 1280,
      height: 720,
      toDataURL: vi.fn(() => 'data:image/png;base64,image'),
    } as unknown as HTMLCanvasElement;
    vi.mocked(html2canvas).mockResolvedValue(canvas);

    const result = await captureElement({ offsetWidth: 640, offsetHeight: 360 } as HTMLElement, {
      mutateSource: false,
    });

    expect(result.dataUrl).toBe('data:image/png;base64,image');
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png');
  });

  it('renders the full authored stage before scaling it to the target size', async () => {
    const canvas = {
      width: 1920,
      height: 1080,
      toDataURL: vi.fn(() => ''),
    } as unknown as HTMLCanvasElement;
    vi.mocked(html2canvas).mockResolvedValue(canvas);

    const drawImage = vi.fn();
    const outputCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        drawImage,
        imageSmoothingEnabled: false,
        imageSmoothingQuality: 'low',
      })),
      toDataURL: vi.fn(() => ''),
    } as unknown as HTMLCanvasElement;
    vi.stubGlobal('document', { createElement: vi.fn(() => outputCanvas) });

    try {
      const result = await captureElement({ offsetWidth: 1920, offsetHeight: 1080 } as HTMLElement, {
        width: 1280,
        height: 720,
        mutateSource: false,
        includeDataUrl: false,
      });

      expect(html2canvas).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ width: 1920, height: 1080, scale: 1 }),
      );
      expect(outputCanvas.width).toBe(1280);
      expect(outputCanvas.height).toBe(720);
      expect(drawImage).toHaveBeenCalledWith(canvas, 0, 0, 1280, 720);
      expect(result.canvas).toBe(outputCanvas);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('disables restarted CSS animations in the cloned export stage', async () => {
    const canvas = {
      width: 640,
      height: 360,
      toDataURL: vi.fn(() => ''),
    } as unknown as HTMLCanvasElement;
    vi.mocked(html2canvas).mockResolvedValue(canvas);

    const stageStyle = { setProperty: vi.fn() };
    const childStyle = { setProperty: vi.fn() };
    const child = { style: childStyle } as unknown as HTMLElement;
    const clonedStage = {
      style: stageStyle,
      querySelectorAll: vi.fn(() => [child]),
    } as unknown as HTMLElement;
    const clonedDoc = {
      querySelector: vi.fn(() => clonedStage),
      querySelectorAll: vi.fn(() => []),
      body: { style: {}, appendChild: vi.fn() },
    } as unknown as Document;
    const element = {
      offsetWidth: 640,
      offsetHeight: 360,
      matches: vi.fn(() => true),
    } as unknown as HTMLElement;

    await captureElement(element, { scale: 1, mutateSource: false, includeDataUrl: false });
    const options = vi.mocked(html2canvas).mock.calls[0][1];
    options?.onclone?.(clonedDoc, element);

    expect(stageStyle.setProperty).toHaveBeenCalledWith('animation', 'none', 'important');
    expect(stageStyle.setProperty).toHaveBeenCalledWith('transition', 'none', 'important');
    expect(childStyle.setProperty).toHaveBeenCalledWith('animation', 'none', 'important');
    expect(childStyle.setProperty).toHaveBeenCalledWith('transition', 'none', 'important');
  });
});
