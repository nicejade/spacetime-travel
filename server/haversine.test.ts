import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { haversineKm } from './haversine.js';

describe('haversineKm', () => {
  it('returns 0 for the same point', () => {
    assert.equal(haversineKm(31.23, 121.47, 31.23, 121.47), 0);
  });

  it('computes great-circle distance between Shanghai and Beijing', () => {
    const km = haversineKm(31.2304, 121.4737, 39.9042, 116.4074);
    // Published great-circle distance is ~1067–1080 km
    assert.ok(km > 1050 && km < 1100, `expected ~1068 km, got ${km}`);
  });

  it('is symmetric', () => {
    const a = haversineKm(35.0116, 135.7681, 37.5665, 126.978);
    const b = haversineKm(37.5665, 126.978, 35.0116, 135.7681);
    assert.ok(Math.abs(a - b) < 1e-9);
  });
});
