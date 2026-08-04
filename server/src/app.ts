import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import fs from 'node:fs';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/api.js';

/**
 * Build a configured Fastify instance (no listen).
 * Importing this module also initializes the SQLite connection via route → service → model → db.
 */
export async function buildApp() {
  // Ensure DB is ready before handling requests (side-effect import).
  await import('./db/connection.js');

  const app = Fastify({
    bodyLimit: config.bodyLimit
  });

  app.setErrorHandler(errorHandler);

  await app.register(apiRoutes, { prefix: '/api' });

  if (fs.existsSync(config.publicPath)) {
    await app.register(fastifyStatic, {
      root: config.publicPath,
      prefix: '/'
    });

    app.setNotFoundHandler(async (request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api')) {
        return reply.sendFile('index.html', config.publicPath);
      }

      return reply.status(404).send({ error: 'Not found' });
    });
  }

  return app;
}
