import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  NARROW_VIEWPORT_MQ,
  canOpenMapSurfaces,
  shouldShowStatsView
} from './viewport.ts';

describe('viewport', () => {
  it('uses a 999px max-width media query for the 1000px breakpoint', () => {
    assert.equal(NARROW_VIEWPORT_MQ, '(max-width: 999px)');
  });

  it('hides stats view when the viewport is narrow', () => {
    assert.equal(shouldShowStatsView(true, true), false);
    assert.equal(shouldShowStatsView(false, true), true);
    assert.equal(shouldShowStatsView(false, false), false);
  });

  it('blocks map surfaces when narrow', () => {
    assert.equal(canOpenMapSurfaces(true), false);
    assert.equal(canOpenMapSurfaces(false), true);
  });
});
