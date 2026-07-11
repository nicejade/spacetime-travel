import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { projection } from '$lib/geo';
import { pickLonLatAt, viewportToMapPoint } from './pickLonLat';

describe('viewportToMapPoint', () => {
  it('undoes pan and scale into map coordinates', () => {
    assert.deepEqual(
      viewportToMapPoint({ x: 200, y: 150 }, { pan: { x: 100, y: 50 }, scale: 2 }),
      { x: 50, y: 50 }
    );
  });
});

describe('pickLonLatAt', () => {
  it('round-trips a projected land point with country', () => {
    const [mapX, mapY] = projection([139.6917, 35.6895]) ?? [0, 0];
    const picked = pickLonLatAt(
      { x: mapX * 2 + 40, y: mapY * 2 + 20 },
      { pan: { x: 40, y: 20 }, scale: 2 }
    );
    assert.ok(picked);
    assert.ok(Math.abs(picked.lng - 139.6917) < 0.01);
    assert.ok(Math.abs(picked.lat - 35.6895) < 0.01);
    assert.equal(picked.country, '日本');
  });

  it('returns null for out-of-range inversions', () => {
    assert.equal(pickLonLatAt({ x: -1e9, y: -1e9 }, { pan: { x: 0, y: 0 }, scale: 1 }), null);
  });
});
