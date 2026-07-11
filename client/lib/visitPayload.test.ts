import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Visit } from './types';
import { visitToPayload } from './visitPayload';

function makeVisit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 7,
    arrivedAt: '2024-06-01',
    departedAt: '2024-06-03',
    feeling: '平静',
    food: '拉面',
    rating: 4.5,
    mood: '好',
    weather: '晴',
    memory: '记忆',
    tags: '城市',
    sequence: 2,
    returnsToOrigin: false,
    outboundTransport: 'flight',
    outboundNote: '去程',
    returnTransport: null,
    returnNote: '',
    inboundTransport: 'train',
    inboundNote: '站间',
    location: {
      id: 1,
      name: '东京',
      country: '日本',
      lat: 35.68,
      lng: 139.69,
      kind: 'city'
    },
    origin: {
      id: 2,
      name: '杭州',
      country: '中国',
      lat: 30.27,
      lng: 120.15,
      kind: 'city'
    },
    ...overrides
  };
}

describe('visitToPayload', () => {
  it('maps location, origin, and memory fields for recreate', () => {
    const payload = visitToPayload(makeVisit());
    assert.equal(payload.locationName, '东京');
    assert.equal(payload.country, '日本');
    assert.equal(payload.lat, 35.68);
    assert.equal(payload.originName, '杭州');
    assert.equal(payload.returnsToOrigin, false);
    assert.equal(payload.inboundTransport, 'train');
    assert.equal(payload.departedAt, '2024-06-03');
    assert.equal(payload.returnTransport, undefined);
  });

  it('omits null departedAt', () => {
    const payload = visitToPayload(makeVisit({ departedAt: null, inboundTransport: null }));
    assert.equal(payload.departedAt, undefined);
    assert.equal(payload.inboundTransport, undefined);
  });
});
