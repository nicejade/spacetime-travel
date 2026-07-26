// scripts/smoke-visit-origin.mjs
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultDbPath = path.join(root, 'server', 'data', 'spacetime-travel.sqlite');

function countVisits(dbFile) {
  if (!fs.existsSync(dbFile)) return 0;
  const handle = new Database(dbFile, { readonly: true, fileMustExist: true });
  try {
    return handle.prepare('SELECT COUNT(*) AS count FROM visits').get().count;
  } finally {
    handle.close();
  }
}

const visitsBefore = countVisits(defaultDbPath);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spacetime-smoke-'));
const tempDbPath = path.join(tempDir, 'smoke.sqlite');
process.env.SPACETIME_DB_PATH = tempDbPath;

try {
  const { createVisit, db, getAtlas } = await import('../server/db.ts');

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

  db.close();
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

const visitsAfter = countVisits(defaultDbPath);
console.assert(
  visitsBefore === visitsAfter,
  `default DB polluted: visit count ${visitsBefore} -> ${visitsAfter}`
);
console.log('smoke ok');
