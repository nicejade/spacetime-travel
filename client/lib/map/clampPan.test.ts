import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clampMapPan, clampContainedPan } from './clampPan';

describe('clampMapPan', () => {
  const base = {
    mapWidth: 2400,
    mapHeight: 1200,
    viewportWidth: 1000,
    viewportHeight: 800,
    overlapRatio: 0.3
  };

  it('keeps a zoomed-in map from leaving the viewport', () => {
    const clamped = clampMapPan({ x: -10000, y: -10000 }, 2, base);
    assert.ok(clamped.x > -10000);
    assert.ok(clamped.y > -10000);
    // Map right edge must still overlap the left overlap band.
    assert.ok(clamped.x + 2400 * 2 >= 1000 * 0.3);
    assert.ok(clamped.y + 1200 * 2 >= 800 * 0.3);
  });

  it('keeps a zoomed-in map from shifting too far positive', () => {
    const clamped = clampMapPan({ x: 5000, y: 5000 }, 2, base);
    assert.ok(clamped.x < 5000);
    assert.ok(clamped.y < 5000);
    assert.ok(clamped.x <= 1000 - 1000 * 0.3);
    assert.ok(clamped.y <= 800 - 800 * 0.3);
  });

  it('leaves an already-valid pan unchanged', () => {
    const pan = { x: -800, y: -400 };
    assert.deepEqual(clampMapPan(pan, 2, base), pan);
  });

  it('allows the centered fit position when the map is smaller than the viewport', () => {
    const scale = 0.3;
    const centered = {
      x: (1000 - 2400 * scale) / 2,
      y: (800 - 1200 * scale) / 2
    };
    assert.deepEqual(clampMapPan(centered, scale, base), centered);
  });
});

describe('clampContainedPan', () => {
  it('locks pan to origin at scale 1', () => {
    assert.deepEqual(
      clampContainedPan({ x: -50, y: 20 }, 1, { mapWidth: 2400, mapHeight: 1200 }),
      { x: 0, y: 0 }
    );
  });

  it('keeps the map edges from leaving the origin corner when zoomed in', () => {
    const clamped = clampContainedPan(
      { x: -10000, y: -10000 },
      2,
      { mapWidth: 2400, mapHeight: 1200 }
    );
    assert.deepEqual(clamped, { x: -2400, y: -1200 });
  });

  it('leaves a valid contained pan unchanged', () => {
    const pan = { x: -100, y: -50 };
    assert.deepEqual(
      clampContainedPan(pan, 2, { mapWidth: 2400, mapHeight: 1200 }),
      pan
    );
  });
});
