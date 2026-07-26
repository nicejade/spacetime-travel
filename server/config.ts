import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT || 5168),
  host: '0.0.0.0' as const,
  /** Max JSON body size (export/import can be large). */
  bodyLimit: 5 * 1024 * 1024,
  publicPath: path.resolve(__dirname, 'public'),
  defaultDbPath: path.join(path.resolve(__dirname, '..', 'data'), 'spacetime-travel.sqlite'),
  get dbPath() {
    return process.env.SPACETIME_DB_PATH?.trim() || this.defaultDbPath;
  }
} as const;
