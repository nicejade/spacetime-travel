import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { migrate } from './migrations.js';
import { rebuildSequencesAndLegs } from '../services/rebuildLegs.js';

const dbPath = config.dbPath;

if (dbPath !== ':memory:') {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
migrate(db);

/** One-shot backfill for DBs whose legs were written before distance_km was populated. */
function backfillLegDistancesIfNeeded() {
  const missing = db
    .prepare(`SELECT COUNT(*) AS count FROM legs WHERE distance_km IS NULL`)
    .get() as { count: number };
  if (missing.count > 0) {
    rebuildSequencesAndLegs(db);
  }
}

backfillLegDistancesIfNeeded();
