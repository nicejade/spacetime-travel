import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { panForZoomAt } from './panZoom';

describe('panForZoomAt', () => {
  it('keeps the world point under the anchor fixed when scaling', () => {
    const pan = { x: 100, y: 50 };
    const scale = 1;
    const nextScale = 2;
    const anchor = { x: 200, y: 150 };

    const nextPan = panForZoomAt(pan, scale, nextScale, anchor);

    const worldBefore = {
      x: (anchor.x - pan.x) / scale,
      y: (anchor.y - pan.y) / scale
    };
    const worldAfter = {
      x: (anchor.x - nextPan.x) / nextScale,
      y: (anchor.y - nextPan.y) / nextScale
    };
    assert.deepEqual(worldAfter, worldBefore);
    assert.deepEqual(nextPan, { x: 0, y: -50 });
  });

  it('is a no-op when scale does not change', () => {
    const pan = { x: 40, y: 60 };
    assert.deepEqual(panForZoomAt(pan, 1.5, 1.5, { x: 10, y: 20 }), pan);
  });
});
