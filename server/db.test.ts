import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import type { VisitPayloadInput } from './types.js';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spacetime-db-api-'));
const tempDbPath = path.join(tempDir, 'test.sqlite');
process.env.SPACETIME_DB_PATH = tempDbPath;

const { createVisit, db, deleteVisit, getAtlas, getExportDocument, importReplace, updateVisit } =
  await import('./db.js');

after(() => {
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function payload(overrides: Partial<VisitPayloadInput> = {}): VisitPayloadInput {
  return {
    originName: '杭州',
    originCountry: '中国',
    originLat: 30.2741,
    originLng: 120.1551,
    locationName: '测试城',
    country: '测试国',
    lat: 1.23,
    lng: 4.56,
    arrivedAt: '2024-06-01',
    outboundTransport: 'flight',
    returnsToOrigin: true,
    inboundTransport: 'flight',
    inboundNote: 'test leg',
    ...overrides
  };
}

describe('db createVisit / getAtlas', () => {
  it('seeds an empty database and exposes origin + visitRoutes', () => {
    const atlas = getAtlas();
    assert.ok(atlas.visits.length > 0);
    assert.ok(atlas.visits[0].origin?.name);
    assert.ok(atlas.visitRoutes.length >= atlas.visits.length);
    assert.equal(atlas.legs.length, atlas.visits.length - 1);
  });

  it('creates a visit, rebuilds sequences, and writes leg distance', () => {
    const before = getAtlas().visits.length;
    const { visitId } = createVisit(
      payload({
        locationName: '奥斯陆',
        country: '挪威',
        lat: 59.91,
        lng: 10.75,
        arrivedAt: '2026-01-15',
        inboundTransport: 'flight'
      })
    );

    const atlas = getAtlas();
    assert.equal(atlas.visits.length, before + 1);
    const created = atlas.visits.find((visit) => visit.id === visitId);
    assert.ok(created);
    assert.equal(created.location.name, '奥斯陆');
    assert.equal(created.sequence, atlas.visits.length);

    const inboundLeg = atlas.legs.find((leg) => leg.toVisitId === visitId);
    assert.ok(inboundLeg);
    assert.equal(inboundLeg.transport, 'flight');
    assert.ok(inboundLeg.distanceKm != null && inboundLeg.distanceKm > 0);
  });
});

describe('db sequence reorder and delete', () => {
  it('reorders sequences and legs when inserting a middle date', () => {
    const early = createVisit(
      payload({
        locationName: '早站',
        country: '序测',
        lat: 10,
        lng: 10,
        arrivedAt: '2030-01-01',
        inboundTransport: 'train'
      })
    ).visitId;
    const late = createVisit(
      payload({
        locationName: '晚站',
        country: '序测',
        lat: 20,
        lng: 20,
        arrivedAt: '2030-01-20',
        inboundTransport: 'bus'
      })
    ).visitId;
    const mid = createVisit(
      payload({
        locationName: '中站',
        country: '序测',
        lat: 15,
        lng: 15,
        arrivedAt: '2030-01-10',
        inboundTransport: 'ferry'
      })
    ).visitId;

    const atlas = getAtlas();
    const byId = new Map(atlas.visits.map((visit) => [visit.id, visit]));
    assert.ok(byId.get(early)!.sequence < byId.get(mid)!.sequence);
    assert.ok(byId.get(mid)!.sequence < byId.get(late)!.sequence);

    const midLeg = atlas.legs.find((leg) => leg.toVisitId === mid);
    assert.ok(midLeg);
    assert.equal(midLeg.fromVisitId, early);
    assert.equal(midLeg.transport, 'ferry');

    const lateLeg = atlas.legs.find((leg) => leg.toVisitId === late);
    assert.ok(lateLeg);
    assert.equal(lateLeg.fromVisitId, mid);
  });

  it('rebuilds adjacent legs after deleting a middle visit', () => {
    const a = createVisit(
      payload({
        locationName: '删A',
        country: '删测',
        lat: 30,
        lng: 30,
        arrivedAt: '2031-01-01',
        inboundTransport: 'train'
      })
    ).visitId;
    const b = createVisit(
      payload({
        locationName: '删B',
        country: '删测',
        lat: 31,
        lng: 31,
        arrivedAt: '2031-01-10',
        inboundTransport: 'flight'
      })
    ).visitId;
    const c = createVisit(
      payload({
        locationName: '删C',
        country: '删测',
        lat: 32,
        lng: 32,
        arrivedAt: '2031-01-20',
        inboundTransport: 'bus'
      })
    ).visitId;

    deleteVisit(b);

    const atlas = getAtlas();
    assert.equal(atlas.visits.some((visit) => visit.id === b), false);
    assert.equal(atlas.legs.some((leg) => leg.fromVisitId === b || leg.toVisitId === b), false);

    const bridge = atlas.legs.find((leg) => leg.fromVisitId === a && leg.toVisitId === c);
    assert.ok(bridge);
    assert.equal(bridge.transport, 'bus');
  });
});

describe('db location reuse', () => {
  it('reuses the same location row for identical name + country', () => {
    const first = createVisit(
      payload({
        locationName: '复用城',
        country: '复用国',
        lat: 40,
        lng: 40,
        arrivedAt: '2032-01-01'
      })
    ).visitId;
    const second = createVisit(
      payload({
        locationName: '复用城',
        country: '复用国',
        lat: 41,
        lng: 41,
        arrivedAt: '2032-02-01'
      })
    ).visitId;

    const atlas = getAtlas();
    const firstVisit = atlas.visits.find((visit) => visit.id === first)!;
    const secondVisit = atlas.visits.find((visit) => visit.id === second)!;
    assert.equal(firstVisit.location.id, secondVisit.location.id);
    // Reuse must not mutate coordinates of the shared entity.
    assert.equal(firstVisit.location.lat, 40);
    assert.equal(secondVisit.location.lat, 40);
  });

  it('purges orphan locations after update rebinds away', () => {
    const { visitId } = createVisit(
      payload({
        locationName: '孤儿前',
        country: '孤儿国',
        lat: 50,
        lng: 50,
        arrivedAt: '2033-01-01',
        originName: '孤儿起点',
        originCountry: '孤儿国',
        originLat: 51,
        originLng: 51
      })
    );

    const before = getAtlas().visits.find((visit) => visit.id === visitId)!;
    const oldLocationId = before.location.id;

    updateVisit(
      visitId,
      payload({
        locationName: '孤儿后',
        country: '孤儿国',
        lat: 52,
        lng: 52,
        arrivedAt: '2033-01-01',
        originName: '杭州',
        originCountry: '中国',
        originLat: 30.2741,
        originLng: 120.1551
      })
    );

    const remaining = db
      .prepare('SELECT id FROM locations WHERE id = ?')
      .get(oldLocationId) as { id: number } | undefined;
    assert.equal(remaining, undefined);
  });
});

describe('db export / import replace', () => {
  it('round-trips visits through export and replace import', () => {
    const exported = getExportDocument();
    assert.ok(exported.visits.length > 0);
    assert.equal(typeof exported.schemaVersion, 'number');

    const snapshot = exported.visits.map((visit) => ({
      locationName: visit.locationName,
      country: visit.country,
      arrivedAt: visit.arrivedAt,
      returnsToOrigin: visit.returnsToOrigin,
      outboundTransport: visit.outboundTransport
    }));

    createVisit(
      payload({
        locationName: '应被替换',
        country: '临时',
        lat: 1,
        lng: 1,
        arrivedAt: '2099-01-01'
      })
    );
    assert.ok(getAtlas().visits.some((visit) => visit.location.name === '应被替换'));

    const result = importReplace(exported);
    assert.equal(result.visitCount, snapshot.length);

    const atlas = getAtlas();
    assert.equal(atlas.visits.length, snapshot.length);
    assert.equal(atlas.visits.some((visit) => visit.location.name === '应被替换'), false);
    assert.deepEqual(
      atlas.visits.map((visit) => ({
        locationName: visit.location.name,
        country: visit.location.country,
        arrivedAt: visit.arrivedAt,
        returnsToOrigin: visit.returnsToOrigin,
        outboundTransport: visit.outboundTransport
      })),
      snapshot
    );
    assert.equal(atlas.legs.length, Math.max(0, atlas.visits.length - 1));
  });

  it('rejects bad import payloads without wiping data', () => {
    const before = getAtlas().visits.length;
    assert.throws(() => importReplace({ format: 'nope', schemaVersion: 1, visits: [] }), /无法识别/);
    assert.equal(getAtlas().visits.length, before);
  });

  it('rejects invalid visit rows inside an otherwise valid document', () => {
    const before = getAtlas().visits.length;
    assert.throws(
      () =>
        importReplace({
          format: 'spacetime-travel',
          schemaVersion: 1,
          visits: [
            {
              locationName: '坏点',
              country: 'X',
              lat: 1,
              lng: 1,
              arrivedAt: 'not-a-date',
              originName: '家',
              originCountry: '中国',
              originLat: 30,
              originLng: 120
            }
          ]
        }),
      /到达时间/
    );
    assert.equal(getAtlas().visits.length, before);
  });
});

describe('db delete then recreate (undo path)', () => {
  it('restores chronological legs when a middle visit is recreated', () => {
    const a = createVisit(
      payload({
        locationName: '撤A',
        country: '撤销测',
        lat: 11,
        lng: 11,
        arrivedAt: '2040-01-01',
        inboundTransport: 'train'
      })
    ).visitId;
    const b = createVisit(
      payload({
        locationName: '撤B',
        country: '撤销测',
        lat: 12,
        lng: 12,
        arrivedAt: '2040-01-10',
        inboundTransport: 'flight',
        feeling: '中间站'
      })
    ).visitId;
    const c = createVisit(
      payload({
        locationName: '撤C',
        country: '撤销测',
        lat: 13,
        lng: 13,
        arrivedAt: '2040-01-20',
        inboundTransport: 'bus'
      })
    ).visitId;

    const middle = getAtlas().visits.find((visit) => visit.id === b)!;
    const restore = {
      locationName: middle.location.name,
      country: middle.location.country,
      lat: middle.location.lat,
      lng: middle.location.lng,
      arrivedAt: middle.arrivedAt,
      originName: middle.origin.name,
      originCountry: middle.origin.country,
      originLat: middle.origin.lat,
      originLng: middle.origin.lng,
      returnsToOrigin: middle.returnsToOrigin,
      outboundTransport: middle.outboundTransport,
      inboundTransport: middle.inboundTransport ?? undefined,
      feeling: middle.feeling
    };

    deleteVisit(b);
    const { visitId: restoredId } = createVisit(restore);

    const atlas = getAtlas();
    assert.equal(atlas.visits.some((visit) => visit.id === b), false);
    const restored = atlas.visits.find((visit) => visit.id === restoredId)!;
    assert.equal(restored.location.name, '撤B');
    assert.equal(restored.feeling, '中间站');

    const seq = new Map(atlas.visits.map((visit) => [visit.id, visit.sequence]));
    assert.ok(seq.get(a)! < seq.get(restoredId)!);
    assert.ok(seq.get(restoredId)! < seq.get(c)!);

    assert.ok(atlas.legs.some((leg) => leg.fromVisitId === a && leg.toVisitId === restoredId));
    assert.ok(atlas.legs.some((leg) => leg.fromVisitId === restoredId && leg.toVisitId === c));
  });
});
