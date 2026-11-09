import { describe, expect, it } from 'vitest';
import { alignElements, distributeElements } from '../src/utils/alignment';

describe('alignElements', () => {
  const boxes = [
    { id: 'a', x: 10, y: 20, w: 20, h: 10 },
    { id: 'b', x: 40, y: 50, w: 30, h: 20 },
    { id: 'c', x: 70, y: 30, w: 10, h: 15 },
  ];

  it('aligns left and right to the selection bounds', () => {
    expect(alignElements(boxes, 'left')).toEqual([
      { id: 'b', x: 10, y: 50 },
      { id: 'c', x: 10, y: 30 },
    ]);
    expect(alignElements(boxes, 'right')).toEqual([
      { id: 'a', x: 60, y: 20 },
      { id: 'b', x: 50, y: 50 },
    ]);
  });

  it('aligns horizontal center and vertical middle', () => {
    expect(alignElements(boxes, 'center-h')).toEqual([
      { id: 'a', x: 35, y: 20 },
      { id: 'b', x: 30, y: 50 },
      { id: 'c', x: 40, y: 30 },
    ]);
    expect(alignElements(boxes, 'middle-v')).toEqual([
      { id: 'a', x: 10, y: 40 },
      { id: 'b', x: 40, y: 35 },
      { id: 'c', x: 70, y: 37.5 },
    ]);
  });

  it('aligns top and bottom to the selection bounds', () => {
    expect(alignElements(boxes, 'top')).toEqual([
      { id: 'b', x: 40, y: 20 },
      { id: 'c', x: 70, y: 20 },
    ]);
    expect(alignElements(boxes, 'bottom')).toEqual([
      { id: 'a', x: 10, y: 60 },
      { id: 'c', x: 70, y: 55 },
    ]);
  });

  it('aligns a single element to the canvas', () => {
    const single = [{ id: 'only', x: 30, y: 30, w: 20, h: 10 }];
    expect(alignElements(single, 'left')).toEqual([{ id: 'only', x: 0, y: 30 }]);
    expect(alignElements(single, 'center-h')).toEqual([{ id: 'only', x: 40, y: 30 }]);
    expect(alignElements(single, 'right')).toEqual([{ id: 'only', x: 80, y: 30 }]);
    expect(alignElements(single, 'top')).toEqual([{ id: 'only', x: 30, y: 0 }]);
    expect(alignElements(single, 'middle-v')).toEqual([{ id: 'only', x: 30, y: 45 }]);
    expect(alignElements(single, 'bottom')).toEqual([{ id: 'only', x: 30, y: 90 }]);
  });

  it('returns only changed elements and never goes off-canvas', () => {
    expect(alignElements([{ id: 'a', x: 0, y: 0, w: 20, h: 10 }], 'left')).toEqual([]);
    expect(alignElements([{ id: 'a', x: -20, y: 0, w: 20, h: 10 }], 'left')).toEqual([{ id: 'a', x: 0, y: 0 }]);
  });
});

describe('distributeElements', () => {
  it('distributes three boxes with equal horizontal gaps', () => {
    const boxes = [
      { id: 'a', x: 10, y: 0, w: 10, h: 10 },
      { id: 'b', x: 35, y: 0, w: 20, h: 10 },
      { id: 'c', x: 60, y: 0, w: 30, h: 10 },
    ];
    expect(distributeElements(boxes, 'horizontal')).toEqual([{ id: 'b', x: 30, y: 0 }]);
  });

  it('distributes three boxes with equal vertical gaps', () => {
    const boxes = [
      { id: 'a', x: 0, y: 10, w: 10, h: 10 },
      { id: 'b', x: 0, y: 35, w: 10, h: 20 },
      { id: 'c', x: 0, y: 60, w: 10, h: 30 },
    ];
    expect(distributeElements(boxes, 'vertical')).toEqual([{ id: 'b', x: 0, y: 30 }]);
  });

  it('requires at least three elements', () => {
    expect(distributeElements([
      { id: 'a', x: 10, y: 10, w: 10, h: 10 },
      { id: 'b', x: 40, y: 10, w: 10, h: 10 },
    ], 'horizontal')).toEqual([]);
  });
});
