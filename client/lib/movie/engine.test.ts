import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Leg } from '$lib/types';
import { resolveLegs } from './engine';
import type { PlottedVisit } from './types';

function visit(partial: Partial<PlottedVisit> & Pick<PlottedVisit, 'id' | 'arrivedAt'>): PlottedVisit {
  const location = {
    id: partial.id,
    name: `Place ${partial.id}`,
    country: 'CN',
    lat: 0,
    lng: 0,
    kind: 'city'
  };
  return {
    departedAt: null,
    feeling: '',
    food: '',
    rating: 4.5,
    mood: '',
    weather: '',
    memory: '',
    tags: '',
    sequence: partial.id,
    location,
    origin: location,
    returnsToOrigin: false,
    outboundTransport: 'train',
    outboundNote: '',
    returnTransport: null,
    returnNote: '',
    inboundTransport: null,
    inboundNote: null,
    x: partial.id * 10,
    y: partial.id * 10,
    yearColor: '#000',
    ...partial
  };
}

function leg(partial: Pick<Leg, 'id' | 'fromVisitId' | 'toVisitId' | 'transport'>): Leg {
  return {
    durationHours: null,
    distanceKm: null,
    note: '',
    sequence: partial.id,
    ...partial
  };
}

describe('resolveLegs', () => {
  it('returns empty list for fewer than two visits', () => {
    assert.deepEqual(resolveLegs([], []), []);
    assert.deepEqual(resolveLegs([visit({ id: 1, arrivedAt: '2024-01-01' })], []), []);
  });

  it('matches legs by from/to visit id and uses leg transport', () => {
    const visits = [
      visit({ id: 1, arrivedAt: '2024-01-01' }),
      visit({ id: 2, arrivedAt: '2024-02-01' }),
      visit({ id: 3, arrivedAt: '2024-03-01' })
    ];
    const legs = [
      leg({ id: 10, fromVisitId: 1, toVisitId: 2, transport: 'flight' }),
      leg({ id: 11, fromVisitId: 2, toVisitId: 3, transport: 'train' })
    ];

    const resolved = resolveLegs(visits, legs);

    assert.equal(resolved.length, 2);
    assert.equal(resolved[0].leg?.id, 10);
    assert.equal(resolved[0].transport, 'flight');
    assert.equal(resolved[0].fromIndex, 0);
    assert.equal(resolved[0].toIndex, 1);
    assert.equal(resolved[1].leg?.id, 11);
    assert.equal(resolved[1].transport, 'train');
    assert.equal(resolved[1].fromIndex, 1);
    assert.equal(resolved[1].toIndex, 2);
  });

  it('falls back to inboundTransport then walk when no leg matches', () => {
    const visits = [
      visit({ id: 1, arrivedAt: '2024-01-01' }),
      visit({ id: 2, arrivedAt: '2024-02-01', inboundTransport: 'ferry' }),
      visit({ id: 3, arrivedAt: '2024-03-01', inboundTransport: null })
    ];

    const resolved = resolveLegs(visits, []);

    assert.equal(resolved[0].leg, null);
    assert.equal(resolved[0].transport, 'ferry');
    assert.equal(resolved[1].leg, null);
    assert.equal(resolved[1].transport, 'walk');
  });

  it('ignores unrelated legs and still resolves adjacent pairs', () => {
    const visits = [
      visit({ id: 1, arrivedAt: '2024-01-01' }),
      visit({ id: 2, arrivedAt: '2024-02-01' }),
      visit({ id: 3, arrivedAt: '2024-03-01' })
    ];
    const legs = [
      leg({ id: 99, fromVisitId: 9, toVisitId: 8, transport: 'bus' }),
      leg({ id: 11, fromVisitId: 2, toVisitId: 3, transport: 'drive' })
    ];

    const resolved = resolveLegs(visits, legs);

    assert.equal(resolved[0].leg, null);
    assert.equal(resolved[0].transport, 'walk');
    assert.equal(resolved[1].leg?.id, 11);
    assert.equal(resolved[1].transport, 'drive');
  });
});
