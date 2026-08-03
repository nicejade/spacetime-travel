import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
/** `server/` under tsx, or `dist/server/` under node — both map to repo root. */
const repoRoot =
  path.basename(path.dirname(here)) === 'dist'
    ? path.resolve(here, '../..')
    : path.resolve(here, '..');

export const config = {
  port: Number(process.env.PORT || 5168),
  host: '0.0.0.0' as const,
  bodyLimit: 5 * 1024 * 1024,
  publicPath: path.join(repoRoot, 'server', 'public'),
  defaultDbPath: path.join(repoRoot, 'server', 'data', 'spacetime-travel.sqlite'),
  get dbPath() {
    return process.env.SPACETIME_DB_PATH?.trim() || this.defaultDbPath;
  }
} as const;
