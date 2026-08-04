import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const segments = here.split(path.sep);
const isCompiled = segments.includes('dist');
/** `server/src` under tsx, or `server/dist/server/src` under node. */
const repoRoot = isCompiled
  ? path.resolve(here, '../../../..')
  : path.resolve(here, '../..');

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
