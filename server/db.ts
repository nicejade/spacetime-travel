/**
 * Public data-layer barrel for tests and scripts.
 * Prefer importing from models/services in new server code.
 */
export { db } from './db/connection.js';
export { getAtlas } from './models/atlas.js';
export {
  createVisit,
  deleteVisit,
  updateVisit
} from './services/visitService.js';
export {
  getExportDocument,
  importReplace
} from './services/exportImportService.js';
