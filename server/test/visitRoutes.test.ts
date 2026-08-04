import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildVisitRoutes } from '../src/services/visitRoutes.js';

const origin = { id: 1, name: '杭州', country: '中国', lat: 30.27, lng: 120.15, kind: 'city' };
const dest = { id: 2, name: '上海', country: '中国', lat: 31.23, lng: 121.47, kind: 'city' };

const baseVisit = {
  id: 10,
  outboundTransport: 'train',
  outboundNote: '高铁',
  returnTransport: null,
  returnNote: '',
  origin,
  location: dest
};

describe('buildVisitRoutes', () => {
  it('emits outbound and return when returnsToOrigin is true', () => {
    const routes = buildVisitRoutes([{ ...baseVisit, returnsToOrigin: true }]);
    assert.equal(routes.length, 2);
    assert.equal(routes[0].kind, 'outbound');
    assert.equal(routes[0].from.name, '杭州');
    assert.equal(routes[0].to.name, '上海');
    assert.equal(routes[1].kind, 'return');
    assert.equal(routes[1].transport, 'train');
  });

  it('emits only outbound when returnsToOrigin is false', () => {
    const routes = buildVisitRoutes([{ ...baseVisit, returnsToOrigin: false }]);
    assert.equal(routes.length, 1);
    assert.equal(routes[0].kind, 'outbound');
  });

  it('falls back return transport to outbound', () => {
    const routes = buildVisitRoutes([
      { ...baseVisit, returnsToOrigin: true, returnTransport: 'flight' }
    ]);
    assert.equal(routes[1].transport, 'flight');
  });
});
