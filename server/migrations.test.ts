import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import Database from 'better-sqlite3';
import {
  SCHEMA_VERSION,
  bootstrapSchema,
  getUserVersion,
  listIndexNames,
  migrate
} from './migrations.js';

const tempDirs: string[] = [];

function openTempDb(): Database.Database {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spacetime-migrate-'));
  tempDirs.push(dir);
  const db = new Database(path.join(dir, 'test.sqlite'));
  db.pragma('foreign_keys = ON');
  return db;
}

/** Legacy shape: tables exist, user_version stays 0, no FK indexes. */
function seedLegacyV0(db: Database.Database): void {
  bootstrapSchema(db);
  db.exec(`
    DROP INDEX IF EXISTS idx_visits_location_id;
    DROP INDEX IF EXISTS idx_visits_origin_location_id;
    DROP INDEX IF EXISTS idx_legs_from_visit_id;
    DROP INDEX IF EXISTS idx_legs_to_visit_id;
  `);
  db.pragma('user_version = 0');

  db.prepare(
    `INSERT INTO locations (name, country, lat, lng, kind) VALUES (?, ?, ?, ?, ?)`
  ).run('杭州', '中国', 30.27, 120.15, 'city');
  db.prepare(
    `INSERT INTO locations (name, country, lat, lng, kind) VALUES (?, ?, ?, ?, ?)`
  ).run('上海', '中国', 31.23, 121.47, 'city');
  db.prepare(
    `INSERT INTO visits (
      location_id, origin_location_id, arrived_at, sequence
    ) VALUES (2, 1, '2019-03-28', 1)`
  ).run();
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('migrate', () => {
  it('brings an empty database to SCHEMA_VERSION with FK indexes', () => {
    const db = openTempDb();
    migrate(db);

    assert.equal(getUserVersion(db), SCHEMA_VERSION);
    const indexes = listIndexNames(db);
    assert.ok(indexes.includes('idx_visits_location_id'));
    assert.ok(indexes.includes('idx_visits_origin_location_id'));
    assert.ok(indexes.includes('idx_legs_from_visit_id'));
    assert.ok(indexes.includes('idx_legs_to_visit_id'));
    assert.ok(indexes.includes('idx_visits_arrived_at'));

    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .all() as { name: string }[];
    assert.deepEqual(
      tables.map((row) => row.name).filter((name) => !name.startsWith('sqlite_')),
      ['legs', 'locations', 'visits']
    );

    db.close();
  });

  it('upgrades a legacy v0 database without losing rows', () => {
    const db = openTempDb();
    seedLegacyV0(db);
    assert.equal(getUserVersion(db), 0);

    const before = db.prepare('SELECT COUNT(*) AS count FROM visits').get() as { count: number };
    assert.equal(before.count, 1);

    migrate(db);

    assert.equal(getUserVersion(db), SCHEMA_VERSION);
    const after = db.prepare('SELECT COUNT(*) AS count FROM visits').get() as { count: number };
    assert.equal(after.count, 1);

    const visit = db
      .prepare(
        `SELECT v.id, dest.name AS dest, origin.name AS origin
         FROM visits v
         JOIN locations dest ON dest.id = v.location_id
         JOIN locations origin ON origin.id = v.origin_location_id`
      )
      .get() as { id: number; dest: string; origin: string };
    assert.equal(visit.dest, '上海');
    assert.equal(visit.origin, '杭州');

    const indexes = listIndexNames(db);
    assert.ok(indexes.includes('idx_visits_location_id'));
    assert.ok(indexes.includes('idx_legs_to_visit_id'));

    db.close();
  });

  it('is idempotent when migrate runs twice', () => {
    const db = openTempDb();
    migrate(db);
    migrate(db);
    assert.equal(getUserVersion(db), SCHEMA_VERSION);
    db.close();
  });

  it('rejects databases newer than this app', () => {
    const db = openTempDb();
    bootstrapSchema(db);
    db.pragma(`user_version = ${SCHEMA_VERSION + 1}`);
    assert.throws(() => migrate(db), /newer than this app/);
    db.close();
  });
});
