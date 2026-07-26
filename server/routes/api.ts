import type { FastifyPluginAsync } from 'fastify';
import { getAtlasHandler } from '../controllers/atlasController.js';
import {
  exportHandler,
  importHandler
} from '../controllers/exportImportController.js';
import { getHealth } from '../controllers/healthController.js';
import {
  createVisitHandler,
  deleteVisitHandler,
  updateVisitHandler
} from '../controllers/visitController.js';

/**
 * All `/api` routes. Registered with prefix `/api` from the app factory.
 */
const apiRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', getHealth);
  app.get('/atlas', getAtlasHandler);
  app.get('/export', exportHandler);
  app.post('/import', importHandler);

  app.post('/visits', createVisitHandler);
  app.put('/visits/:id', updateVisitHandler);
  app.delete('/visits/:id', deleteVisitHandler);
};

export default apiRoutes;
