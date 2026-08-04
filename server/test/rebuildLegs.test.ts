import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import Database from 'better-sqlite3';
import { ensureLocation } from '../src/locations.js';
import { migrate } from '../src/db/migrations.js';
import { rebuildSequencesAndLegs } from '../src/services/rebuildLegs.js';

const tempDirs: string[] = [];

function openTempDb(): Database.Database {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spacetime-rebuild-'));
  tempDirs.push(dir);
  const db = new Database(path.join(dir, 'test.sqlite'));
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function addVisit(
  db: Database.Database,
  opts: {
    dest: [string, string, number, number];
    origin: [string, string, number, number];
    arrivedAt: string;
    inboundTransport?: string;
  }
): number {
  const [dName, dCountry, dLat, dLng] = opts.dest;
  const [oName, oCountry, oLat, oLng] = opts.origin;
  const locationId = ensureLocation(db, {
    name: dName,
    country: dCountry,
    lat: dLat,
    lng: dLng,
    kind: 'city'
  });
  const originLocationId = ensureLocation(db, {
    name: oName,
    country: oCountry,
    lat: oLat,
    lng: oLng,
    kind: 'city'
  });

  return Number(
    db
      .prepare(
        `INSERT INTO visits (
          location_id, origin_location_id, arrived_at, sequence,
          inbound_transport, inbound_note
        ) VALUES (?, ?, ?, 0, ?, ?)`
      )
      .run(
        locationId,
        originLocationId,
        opts.arrivedAt,
        opts.inboundTransport ?? null,
        opts.inboundTransport ? 'leg note' : ''
      ).lastInsertRowid
  );
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('rebuildSequencesAndLegs', () => {
  it('assigns sequence by arrived_at and builds adjacent legs with distance', () => {
    const db = openTempDb();
    const early = addVisit(db, {
      origin: ['杭州', '中国', 30.27, 120.15],
      dest: ['上海', '中国', 31.23, 121.47],
      arrivedAt: '2019-03-28'
    });
    const late = addVisit(db, {
      origin: ['上海', '中国', 31.23, 121.47],
      dest: ['京都', '日本', 35.01, 135.76],
      arrivedAt: '2019-04-01',
      inboundTransport: 'flight'
    });

    rebuildSequencesAndLegs(db);

    const visits = db
      .prepare('SELECT id, sequence FROM visits ORDER BY sequence ASC')
      .all() as { id: number; sequence: number }[];
    assert.deepEqual(
      visits.map((row) => row.id),
      [early, late]
    );
    assert.deepEqual(
      visits.map((row) => row.sequence),
      [1, 2]
    );

    const legs = db
      .prepare(
        `SELECT from_visit_id, to_visit_id, transport, distance_km, sequence
         FROM legs ORDER BY sequence ASC`
      )
      .all() as {
      from_visit_id: number;
      to_visit_id: number;
      transport: string;
      distance_km: number | null;
      sequence: number;
    }[];

    assert.equal(legs.length, 1);
    assert.equal(legs[0].from_visit_id, early);
    assert.equal(legs[0].to_visit_id, late);
    assert.equal(legs[0].transport, 'flight');
    assert.ok(legs[0].distance_km && legs[0].distance_km > 1000);
    db.close();
  });

  it('reorders sequences and legs when a visit is inserted in the middle', () => {
    const db = openTempDb();
    const first = addVisit(db, {
      origin: ['杭州', '中国', 30.27, 120.15],
      dest: ['上海', '中国', 31.23, 121.47],
      arrivedAt: '2019-03-01'
    });
    const third = addVisit(db, {
      origin: ['首尔', '韩国', 37.56, 126.97],
      dest: ['东京', '日本', 35.68, 139.76],
      arrivedAt: '2019-03-20',
      inboundTransport: 'flight'
    });

    rebuildSequencesAndLegs(db);

    const middle = addVisit(db, {
      origin: ['上海', '中国', 31.23, 121.47],
      dest: ['首尔', '韩国', 37.56, 126.97],
      arrivedAt: '2019-03-10',
      inboundTransport: 'ferry'
    });

    rebuildSequencesAndLegs(db, {
      focusVisitId: middle,
      focusInboundTransport: 'ferry',
      focusInboundNote: '黄海渡轮'
    });

    const ordered = db
      .prepare('SELECT id, sequence, inbound_transport, inbound_note FROM visits ORDER BY sequence ASC')
      .all() as {
      id: number;
      sequence: number;
      inbound_transport: string | null;
      inbound_note: string | null;
    }[];

    assert.deepEqual(
      ordered.map((row) => row.id),
      [first, middle, third]
    );
    assert.deepEqual(
      ordered.map((row) => row.sequence),
      [1, 2, 3]
    );
    assert.equal(ordered[1].inbound_transport, 'ferry');
    assert.equal(ordered[1].inbound_note, '黄海渡轮');

    const legs = db
      .prepare(
        `SELECT from_visit_id, to_visit_id, transport, sequence
         FROM legs ORDER BY sequence ASC`
      )
      .all() as {
      from_visit_id: number;
      to_visit_id: number;
      transport: string;
      sequence: number;
    }[];

    assert.equal(legs.length, 2);
    assert.deepEqual(
      legs.map((leg) => [leg.from_visit_id, leg.to_visit_id, leg.transport]),
      [
        [first, middle, 'ferry'],
        [middle, third, 'flight']
      ]
    );
    db.close();
  });

  it('rebuilds gap edges after deleting a middle visit', () => {
    const db = openTempDb();
    const a = addVisit(db, {
      origin: ['杭州', '中国', 30.27, 120.15],
      dest: ['上海', '中国', 31.23, 121.47],
      arrivedAt: '2019-03-01'
    });
    const b = addVisit(db, {
      origin: ['上海', '中国', 31.23, 121.47],
      dest: ['首尔', '韩国', 37.56, 126.97],
      arrivedAt: '2019-03-10',
      inboundTransport: 'flight'
    });
    const c = addVisit(db, {
      origin: ['首尔', '韩国', 37.56, 126.97],
      dest: ['东京', '日本', 35.68, 139.76],
      arrivedAt: '2019-03-20',
      inboundTransport: 'train'
    });

    rebuildSequencesAndLegs(db);
    db.prepare('DELETE FROM visits WHERE id = ?').run(b);
    rebuildSequencesAndLegs(db);

    const visits = db
      .prepare('SELECT id, sequence FROM visits ORDER BY sequence ASC')
      .all() as { id: number; sequence: number }[];
    assert.deepEqual(
      visits.map((row) => [row.id, row.sequence]),
      [
        [a, 1],
        [c, 2]
      ]
    );

    const legs = db
      .prepare(`SELECT from_visit_id, to_visit_id, transport FROM legs`)
      .all() as { from_visit_id: number; to_visit_id: number; transport: string }[];
    assert.equal(legs.length, 1);
    assert.equal(legs[0].from_visit_id, a);
    assert.equal(legs[0].to_visit_id, c);
    assert.equal(legs[0].transport, 'train');
    db.close();
  });
});
