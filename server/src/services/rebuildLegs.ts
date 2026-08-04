import type Database from 'better-sqlite3';
import { distanceBetweenKm } from '../lib/haversine.js';

export interface RebuildLegsOptions {
  focusVisitId?: number;
  focusInboundTransport?: string;
  focusInboundNote?: string;
}

interface OrderedVisitRow {
  id: number;
  inbound_transport: string | null;
  inbound_note: string | null;
  lat: number;
  lng: number;
}

/**
 * Rewrite `visits.sequence` from chronological order and rebuild adjacent `legs`.
 *
 * Product decision (HANDOFF P0-4): keep `sequence` as a derived cache of
 * `ORDER BY arrived_at ASC, id ASC`. Manual drag-reorder remains a future P5-4
 * feature and must not diverge from arrival order until then.
 */
export function rebuildSequencesAndLegs(
  db: Database.Database,
  options?: RebuildLegsOptions
): void {
  const ordered = db
    .prepare(
      `SELECT
         v.id,
         v.inbound_transport,
         v.inbound_note,
         dest.lat AS lat,
         dest.lng AS lng
       FROM visits v
       JOIN locations dest ON dest.id = v.location_id
       ORDER BY v.arrived_at ASC, v.id ASC`
    )
    .all() as OrderedVisitRow[];

  // Single-statement sequence rewrite (no per-row prepare/N+1).
  db.exec(`
    WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY arrived_at ASC, id ASC) AS seq
      FROM visits
    )
    UPDATE visits
    SET sequence = (SELECT seq FROM ordered WHERE ordered.id = visits.id)
  `);

  if (options?.focusVisitId != null) {
    const transport = options.focusInboundTransport || 'flight';
    const note = options.focusInboundNote || '';
    db.prepare(
      'UPDATE visits SET inbound_transport = ?, inbound_note = ? WHERE id = ?'
    ).run(transport, note, options.focusVisitId);

    const focus = ordered.find((row) => row.id === options.focusVisitId);
    if (focus) {
      focus.inbound_transport = transport;
      focus.inbound_note = note;
    }
  }

  db.prepare('DELETE FROM legs').run();

  if (ordered.length < 2) {
    return;
  }

  const insertLeg = db.prepare(`
    INSERT INTO legs (
      from_visit_id, to_visit_id, transport, duration_hours,
      distance_km, note, sequence
    )
    VALUES (
      @fromVisitId, @toVisitId, @transport, @durationHours,
      @distanceKm, @note, @sequence
    )
  `);

  const insertMany = db.transaction((rows: OrderedVisitRow[]) => {
    for (let i = 1; i < rows.length; i += 1) {
      const from = rows[i - 1];
      const to = rows[i];
      const transport = to.inbound_transport || 'flight';
      const note = to.inbound_note || '';

      insertLeg.run({
        fromVisitId: from.id,
        toVisitId: to.id,
        transport,
        durationHours: null,
        distanceKm: distanceBetweenKm(from, to),
        note,
        sequence: i
      });
    }
  });

  insertMany(ordered);
}
