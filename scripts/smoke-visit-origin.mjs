// scripts/smoke-visit-origin.mjs
import { getAtlas, createVisit } from '../server/db.ts';

const atlas = getAtlas();
console.assert(atlas.visits.length > 0, 'seed visits missing');
console.assert(atlas.visits[0].origin?.name, 'origin missing on visit');
console.assert(atlas.visitRoutes.length >= atlas.visits.length, 'visitRoutes missing');

createVisit({
  originName: '家',
  originCountry: '中国',
  originLat: 30.27,
  originLng: 120.15,
  locationName: '曼谷',
  country: '泰国',
  lat: 13.75,
  lng: 100.52,
  arrivedAt: '2025-06-01',
  outboundTransport: 'flight',
  returnsToOrigin: false,
  inboundTransport: 'flight',
  inboundNote: 'smoke'
});

const updated = getAtlas();
const last = updated.visits.at(-1);
console.assert(last?.returnsToOrigin === false, 'returnsToOrigin not saved');
console.assert(
  updated.visitRoutes.filter((r) => r.visitId === last.id).length === 1,
  'one-way should have 1 route'
);
console.log('smoke ok');
