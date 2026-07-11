import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { legHighlight, visitRouteOpacity } from './legHighlight';
import type { Leg } from '$lib/types';

function leg(partial: Pick<Leg, 'id' | 'fromVisitId' | 'toVisitId'>): Leg {
  return {
    transport: 'train',
    durationHours: null,
    distanceKm: null,
    note: '',
    sequence: partial.id,
    ...partial
  };
}

describe('legHighlight', () => {
  const sample = leg({ id: 1, fromVisitId: 10, toVisitId: 20 });

  it('returns null when nothing should restyle routes', () => {
    assert.equal(legHighlight(sample, null, false, null), null);
  });

  it('highlights adjacent legs for the selected visit outside movie mode', () => {
    assert.equal(legHighlight(sample, 10, false, null), 'active');
    assert.equal(legHighlight(sample, 20, false, null), 'active');
    assert.equal(legHighlight(sample, 99, false, null), 'dimmed');
  });

  it('uses movie active leg while movie mode is on', () => {
    assert.equal(
      legHighlight(sample, 10, true, { fromVisitId: 10, toVisitId: 20 }),
      'active'
    );
    assert.equal(
      legHighlight(sample, 10, true, { fromVisitId: 1, toVisitId: 2 }),
      'dimmed'
    );
  });
});

describe('visitRouteOpacity', () => {
  it('boosts the selected visit route and dims others', () => {
    const base = visitRouteOpacity(1, 'outbound', null, false);
    assert.ok(visitRouteOpacity(1, 'outbound', 1, false) > base);
    assert.ok(visitRouteOpacity(2, 'outbound', 1, false) < base);
  });
});
