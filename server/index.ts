import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVisit, deleteVisit, getAtlas, getExportDocument, importReplace, updateVisit } from './db.js';
import type { HttpError } from './types.js';
import type { VisitPayloadInput } from './types.js';
import { parseVisitId } from './visitValidation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicPath = path.resolve(__dirname, 'public');
const port = Number(process.env.PORT || 5168);

const app = Fastify({
  bodyLimit: 5 * 1024 * 1024
});

app.setErrorHandler((error: HttpError, _request, reply) => {
  const status = error.status ?? error.statusCode ?? 500;
  return reply.code(status).send({
    error: status === 500 ? '服务器暂时不可用' : error.message
  });
});

app.get('/api/health', async () => ({ ok: true }));

app.get('/api/atlas', async () => getAtlas());

app.get('/api/export', async () => getExportDocument());

app.post('/api/import', async (request) => {
  const result = importReplace(request.body);
  return { ok: true, ...result, atlas: getAtlas() };
});

app.post('/api/visits', async (request, reply) => {
  const result = createVisit(request.body as VisitPayloadInput);
  return reply.status(201).send({ ok: true, ...result, atlas: getAtlas() });
});

app.put<{ Params: { id: string } }>('/api/visits/:id', async (request) => {
  const visitId = parseVisitId(request.params.id);
  const result = updateVisit(visitId, request.body as VisitPayloadInput);
  return { ok: true, ...result, atlas: getAtlas() };
});

app.delete<{ Params: { id: string } }>('/api/visits/:id', async (request) => {
  const visitId = parseVisitId(request.params.id);
  const result = deleteVisit(visitId);
  return { ok: true, ...result, atlas: getAtlas() };
});

if (fs.existsSync(publicPath)) {
  await app.register(fastifyStatic, {
    root: publicPath,
    prefix: '/'
  });

  app.setNotFoundHandler(async (request, reply) => {
    if (request.method === 'GET' && !request.url.startsWith('/api')) {
      return reply.sendFile('index.html', publicPath);
    }

    return reply.status(404).send({ error: 'Not found' });
  });
}

try {
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`spacetime-travel API listening on http://localhost:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
