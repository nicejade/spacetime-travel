import type Database from 'better-sqlite3';

/** Current schema version. Bump when adding a migration below. */
export const SCHEMA_VERSION = 1;

type MigrationFn = (db: Database.Database) => void;

/**
 * Bootstrap the latest table shapes for brand-new databases.
 * Existing databases keep their tables; structural changes belong in migrations
 * (ALTER TABLE / CREATE INDEX / data backfills) so user data is preserved.
 */
export function bootstrapSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      country TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      kind TEXT DEFAULT 'city',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id INTEGER NOT NULL,
      origin_location_id INTEGER NOT NULL,
      returns_to_origin INTEGER NOT NULL DEFAULT 1,
      outbound_transport TEXT NOT NULL DEFAULT 'flight',
      outbound_note TEXT DEFAULT '',
      return_transport TEXT,
      return_note TEXT DEFAULT '',
      inbound_transport TEXT,
      inbound_note TEXT DEFAULT '',
      arrived_at TEXT NOT NULL,
      departed_at TEXT,
      feeling TEXT DEFAULT '',
      food TEXT DEFAULT '',
      rating REAL NOT NULL DEFAULT 4,
      mood TEXT DEFAULT '',
      weather TEXT DEFAULT '',
      memory TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      sequence INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT,
      FOREIGN KEY (origin_location_id) REFERENCES locations(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS legs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_visit_id INTEGER NOT NULL,
      to_visit_id INTEGER NOT NULL,
      transport TEXT NOT NULL DEFAULT 'flight',
      duration_hours REAL,
      distance_km REAL,
      note TEXT DEFAULT '',
      sequence INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_visit_id) REFERENCES visits(id) ON DELETE CASCADE,
      FOREIGN KEY (to_visit_id) REFERENCES visits(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_visits_arrived_at ON visits(arrived_at);
    CREATE INDEX IF NOT EXISTS idx_legs_sequence ON legs(sequence);
  `);
}

/**
 * Migration 1: foreign-key column indexes (HANDOFF P0-6).
 * Idempotent via IF NOT EXISTS — safe on fresh and legacy DBs.
 */
const migration1: MigrationFn = (db) => {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_visits_location_id ON visits(location_id);
    CREATE INDEX IF NOT EXISTS idx_visits_origin_location_id ON visits(origin_location_id);
    CREATE INDEX IF NOT EXISTS idx_legs_from_visit_id ON legs(from_visit_id);
    CREATE INDEX IF NOT EXISTS idx_legs_to_visit_id ON legs(to_visit_id);
  `);
};

const migrations: Record<number, MigrationFn> = {
  1: migration1
};

export function getUserVersion(db: Database.Database): number {
  return Number(db.pragma('user_version', { simple: true }));
}

function setUserVersion(db: Database.Database, version: number): void {
  db.pragma(`user_version = ${version}`);
}

/**
 * Ensure tables exist, then apply any pending migrations in order.
 * Each migration runs inside a transaction and bumps `user_version` only on success.
 */
export function migrate(db: Database.Database): void {
  bootstrapSchema(db);

  let current = getUserVersion(db);
  if (current > SCHEMA_VERSION) {
    throw new Error(
      `Database schema version ${current} is newer than this app (supports ${SCHEMA_VERSION}). Upgrade the app before opening this database.`
    );
  }

  while (current < SCHEMA_VERSION) {
    const next = current + 1;
    const fn = migrations[next];
    if (!fn) {
      throw new Error(`Missing migration for schema version ${next}`);
    }

    db.transaction(() => {
      fn(db);
      setUserVersion(db, next);
    })();

    current = next;
  }
}

export function listIndexNames(db: Database.Database): string[] {
  const rows = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'`)
    .all() as { name: string }[];
  return rows.map((row) => row.name).sort();
}
