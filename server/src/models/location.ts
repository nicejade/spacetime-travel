import type Database from 'better-sqlite3';

export interface LocationInput {
  name: string;
  country: string;
  lat: number;
  lng: number;
  kind?: string;
}

interface LocationRow {
  id: number;
  name: string;
  country: string;
  lat: number;
  lng: number;
  kind: string;
}

/** Find a location by the entity key (name + country). */
export function findLocationByNameCountry(
  db: Database.Database,
  name: string,
  country: string
): LocationRow | undefined {
  return db
    .prepare(
      `SELECT id, name, country, lat, lng, kind
       FROM locations
       WHERE name = ? AND country = ?
       ORDER BY id ASC
       LIMIT 1`
    )
    .get(name, country) as LocationRow | undefined;
}

/**
 * Reuse an existing location row for (name, country), or insert a new one.
 * Does not mutate coordinates of an existing shared row.
 */
export function ensureLocation(db: Database.Database, input: LocationInput): number {
  const existing = findLocationByNameCountry(db, input.name, input.country);
  if (existing) {
    return existing.id;
  }

  return Number(
    db
      .prepare(
        `INSERT INTO locations (name, country, lat, lng, kind)
         VALUES (@name, @country, @lat, @lng, @kind)`
      )
      .run({
        name: input.name,
        country: input.country,
        lat: input.lat,
        lng: input.lng,
        kind: input.kind || 'city'
      }).lastInsertRowid
  );
}

function isLocationReferenced(db: Database.Database, locationId: number): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS ok
       FROM visits
       WHERE location_id = ? OR origin_location_id = ?
       LIMIT 1`
    )
    .get(locationId, locationId) as { ok: number } | undefined;
  return Boolean(row);
}

/**
 * Delete location rows that are no longer referenced by any visit.
 * Returns how many rows were removed.
 */
export function purgeOrphanLocations(db: Database.Database, candidateIds: number[]): number {
  const uniqueIds = [...new Set(candidateIds.filter((id) => Number.isFinite(id) && id > 0))];
  const remove = db.prepare('DELETE FROM locations WHERE id = ?');
  let removed = 0;

  for (const id of uniqueIds) {
    if (isLocationReferenced(db, id)) continue;
    const result = remove.run(id);
    removed += result.changes;
  }

  return removed;
}

/**
 * Merge duplicate (name, country) rows: keep the lowest id, rebind visits, delete extras.
 * Returns the number of duplicate rows deleted.
 */
export function mergeDuplicateLocations(db: Database.Database): number {
  const groups = db
    .prepare(
      `SELECT name, country, COUNT(*) AS count, MIN(id) AS canonical_id
       FROM locations
       GROUP BY name, country
       HAVING COUNT(*) > 1`
    )
    .all() as { name: string; country: string; count: number; canonical_id: number }[];

  let deleted = 0;

  const listDupes = db.prepare(
    `SELECT id FROM locations
     WHERE name = ? AND country = ? AND id != ?
     ORDER BY id ASC`
  );
  const rebindDest = db.prepare(`UPDATE visits SET location_id = ? WHERE location_id = ?`);
  const rebindOrigin = db.prepare(
    `UPDATE visits SET origin_location_id = ? WHERE origin_location_id = ?`
  );
  const remove = db.prepare(`DELETE FROM locations WHERE id = ?`);

  for (const group of groups) {
    const dupes = listDupes.all(group.name, group.country, group.canonical_id) as { id: number }[];
    for (const dupe of dupes) {
      rebindDest.run(group.canonical_id, dupe.id);
      rebindOrigin.run(group.canonical_id, dupe.id);
      deleted += remove.run(dupe.id).changes;
    }
  }

  return deleted;
}

/** Unique index enforcing the location entity key. */
export function ensureLocationUniqueIndex(db: Database.Database): void {
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_name_country ON locations(name, country)`
  );
}
