import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import Database from 'better-sqlite3';
import { distanceBetweenKm, visitDestinationCoords } from './haversine.js';
import { ensureLocation } from './locations.js';
import { migrate } from './migrations.js';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('leg distance helpers', () => {
  it('resolves visit destination coords and distance between adjacent stops', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spacetime-leg-km-'));
    tempDirs.push(dir);
    const db = new Database(path.join(dir, 'test.sqlite'));
    db.pragma('foreign_keys = ON');
    migrate(db);

    const shanghai = ensureLocation(db, {
      name: '上海',
      country: '中国',
      lat: 31.2304,
      lng: 121.4737,
      kind: 'city'
    });
    const beijing = ensureLocation(db, {
      name: '北京',
      country: '中国',
      lat: 39.9042,
      lng: 116.4074,
      kind: 'city'
    });
    const hangzhou = ensureLocation(db, {
      name: '杭州',
      country: '中国',
      lat: 30.2741,
      lng: 120.1551,
      kind: 'city'
    });

    const fromId = Number(
      db
        .prepare(
          `INSERT INTO visits (location_id, origin_location_id, arrived_at, sequence)
           VALUES (?, ?, '2019-03-28', 1)`
        )
        .run(shanghai, hangzhou).lastInsertRowid
    );
    const toId = Number(
      db
        .prepare(
          `INSERT INTO visits (location_id, origin_location_id, arrived_at, sequence, inbound_transport)
           VALUES (?, ?, '2019-04-01', 2, 'flight')`
        )
        .run(beijing, shanghai).lastInsertRowid
    );

    const from = visitDestinationCoords(db, fromId);
    const to = visitDestinationCoords(db, toId);
    assert.ok(from);
    assert.ok(to);

    const km = distanceBetweenKm(from, to);
    assert.ok(km > 1050 && km < 1100, `expected ~1068 km, got ${km}`);

    db.close();
  });
});
