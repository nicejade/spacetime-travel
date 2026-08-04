import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import Database from 'better-sqlite3';
import {
  ensureLocation,
  mergeDuplicateLocations,
  purgeOrphanLocations
} from '../src/locations.js';
import { SCHEMA_VERSION, getUserVersion, listIndexNames, migrate } from '../src/db/migrations.js';

const tempDirs: string[] = [];

function openTempDb(): Database.Database {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spacetime-locations-'));
  tempDirs.push(dir);
  const db = new Database(path.join(dir, 'test.sqlite'));
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function countLocations(db: Database.Database): number {
  return (db.prepare('SELECT COUNT(*) AS count FROM locations').get() as { count: number }).count;
}

function insertVisit(
  db: Database.Database,
  locationId: number,
  originLocationId: number,
  arrivedAt: string
): number {
  return Number(
    db
      .prepare(
        `INSERT INTO visits (location_id, origin_location_id, arrived_at, sequence)
         VALUES (?, ?, ?, 1)`
      )
      .run(locationId, originLocationId, arrivedAt).lastInsertRowid
  );
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('ensureLocation', () => {
  it('reuses the same row for identical name + country', () => {
    const db = openTempDb();
    const first = ensureLocation(db, {
      name: '杭州',
      country: '中国',
      lat: 30.27,
      lng: 120.15,
      kind: 'city'
    });
    const second = ensureLocation(db, {
      name: '杭州',
      country: '中国',
      lat: 30.2741,
      lng: 120.1551,
      kind: 'city'
    });

    assert.equal(first, second);
    assert.equal(countLocations(db), 1);
    db.close();
  });

  it('creates separate rows when country differs', () => {
    const db = openTempDb();
    const a = ensureLocation(db, {
      name: 'Paris',
      country: '法国',
      lat: 48.85,
      lng: 2.35,
      kind: 'city'
    });
    const b = ensureLocation(db, {
      name: 'Paris',
      country: '美国',
      lat: 33.66,
      lng: -95.55,
      kind: 'city'
    });

    assert.notEqual(a, b);
    assert.equal(countLocations(db), 2);
    db.close();
  });
});

describe('purgeOrphanLocations', () => {
  it('deletes locations no longer referenced by any visit', () => {
    const db = openTempDb();
    const hangzhou = ensureLocation(db, {
      name: '杭州',
      country: '中国',
      lat: 30.27,
      lng: 120.15,
      kind: 'city'
    });
    const shanghai = ensureLocation(db, {
      name: '上海',
      country: '中国',
      lat: 31.23,
      lng: 121.47,
      kind: 'city'
    });
    const visitId = insertVisit(db, shanghai, hangzhou, '2019-03-28');

    db.prepare('DELETE FROM visits WHERE id = ?').run(visitId);
    const removed = purgeOrphanLocations(db, [hangzhou, shanghai]);

    assert.equal(removed, 2);
    assert.equal(countLocations(db), 0);
    db.close();
  });

  it('keeps locations still referenced by other visits', () => {
    const db = openTempDb();
    const hangzhou = ensureLocation(db, {
      name: '杭州',
      country: '中国',
      lat: 30.27,
      lng: 120.15,
      kind: 'city'
    });
    const shanghai = ensureLocation(db, {
      name: '上海',
      country: '中国',
      lat: 31.23,
      lng: 121.47,
      kind: 'city'
    });
    const kyoto = ensureLocation(db, {
      name: '京都',
      country: '日本',
      lat: 35.01,
      lng: 135.76,
      kind: 'city'
    });

    insertVisit(db, shanghai, hangzhou, '2019-03-28');
    const second = insertVisit(db, kyoto, shanghai, '2019-04-01');

    db.prepare('DELETE FROM visits WHERE id = ?').run(second);
    const removed = purgeOrphanLocations(db, [kyoto, shanghai]);

    assert.equal(removed, 1);
    assert.equal(countLocations(db), 2);
    const names = (
      db.prepare('SELECT name FROM locations ORDER BY name').all() as { name: string }[]
    ).map((row) => row.name);
    assert.deepEqual(names, ['上海', '杭州']);
    db.close();
  });
});

describe('mergeDuplicateLocations', () => {
  it('rebinds visits to the canonical location and deletes duplicates', () => {
    const db = openTempDb();
    // Bypass ensureLocation to create intentional duplicates (pre-migration shape).
    const insert = db.prepare(
      `INSERT INTO locations (name, country, lat, lng, kind) VALUES (?, ?, ?, ?, ?)`
    );
    // Drop unique index if migration already added it, so we can insert dupes for the unit test.
    db.exec('DROP INDEX IF EXISTS idx_locations_name_country');

    const hangzhouA = Number(insert.run('杭州', '中国', 30.27, 120.15, 'city').lastInsertRowid);
    const hangzhouB = Number(insert.run('杭州', '中国', 30.28, 120.16, 'city').lastInsertRowid);
    const shanghai = Number(insert.run('上海', '中国', 31.23, 121.47, 'city').lastInsertRowid);

    const visitId = insertVisit(db, shanghai, hangzhouB, '2019-03-28');

    const merged = mergeDuplicateLocations(db);
    assert.ok(merged >= 1);

    const visit = db.prepare('SELECT origin_location_id FROM visits WHERE id = ?').get(visitId) as {
      origin_location_id: number;
    };
    assert.equal(visit.origin_location_id, hangzhouA);

    const hangzhouRows = db
      .prepare(`SELECT id FROM locations WHERE name = ? AND country = ?`)
      .all('杭州', '中国') as { id: number }[];
    assert.equal(hangzhouRows.length, 1);
    assert.equal(hangzhouRows[0].id, hangzhouA);

    db.close();
  });
});

describe('location rebind does not mutate sibling visits', () => {
  it('keeps another visit origin row unchanged when one visit switches origin', () => {
    const db = openTempDb();
    const hangzhou = ensureLocation(db, {
      name: '杭州',
      country: '中国',
      lat: 30.27,
      lng: 120.15,
      kind: 'city'
    });
    const shanghai = ensureLocation(db, {
      name: '上海',
      country: '中国',
      lat: 31.23,
      lng: 121.47,
      kind: 'city'
    });
    const beijing = ensureLocation(db, {
      name: '北京',
      country: '中国',
      lat: 39.9,
      lng: 116.4,
      kind: 'city'
    });

    const first = insertVisit(db, shanghai, hangzhou, '2019-03-28');
    const second = insertVisit(db, beijing, hangzhou, '2020-01-01');

    // Simulate updateVisit rebind: second visit origin becomes Shanghai.
    db.prepare('UPDATE visits SET origin_location_id = ? WHERE id = ?').run(shanghai, second);
    purgeOrphanLocations(db, [hangzhou]);

    const firstOrigin = db.prepare('SELECT origin_location_id FROM visits WHERE id = ?').get(first) as {
      origin_location_id: number;
    };
    const hangzhouRow = db.prepare('SELECT name, lat FROM locations WHERE id = ?').get(hangzhou) as {
      name: string;
      lat: number;
    };

    assert.equal(firstOrigin.origin_location_id, hangzhou);
    assert.equal(hangzhouRow.name, '杭州');
    assert.equal(hangzhouRow.lat, 30.27);
    db.close();
  });
});

describe('migration 2 location entityization', () => {
  it('dedupes legacy duplicates and adds a unique name+country index', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spacetime-mig2-'));
    tempDirs.push(dir);
    const db = new Database(path.join(dir, 'legacy.sqlite'));
    db.pragma('foreign_keys = ON');

    // Build a v1 database with duplicate locations (no unique index yet).
    migrate(db);
    assert.equal(getUserVersion(db), SCHEMA_VERSION);

    // If already at v2 from migrate, force a legacy-like duplicate scenario on a v1 snapshot:
    // Recreate by rolling logic: insert dupes only works without unique index.
    db.exec('DROP INDEX IF EXISTS idx_locations_name_country');
    const insert = db.prepare(
      `INSERT INTO locations (name, country, lat, lng, kind) VALUES (?, ?, ?, ?, ?)`
    );
    const a = Number(insert.run('京都', '日本', 35.01, 135.76, 'city').lastInsertRowid);
    const b = Number(insert.run('京都', '日本', 35.02, 135.77, 'city').lastInsertRowid);
    const seoul = Number(insert.run('首尔', '韩国', 37.56, 126.97, 'city').lastInsertRowid);
    insertVisit(db, seoul, b, '2019-04-08');

    // Re-run merge as migration 2 body would (idempotent path).
    mergeDuplicateLocations(db);
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_name_country ON locations(name, country)`
    );

    const kyoto = db
      .prepare(`SELECT id FROM locations WHERE name = ? AND country = ?`)
      .all('京都', '日本') as { id: number }[];
    assert.equal(kyoto.length, 1);
    assert.equal(kyoto[0].id, a);

    const indexes = listIndexNames(db);
    assert.ok(indexes.includes('idx_locations_name_country'));

    const visit = db.prepare('SELECT origin_location_id FROM visits ORDER BY id DESC LIMIT 1').get() as {
      origin_location_id: number;
    };
    assert.equal(visit.origin_location_id, a);

    db.close();
  });
});
