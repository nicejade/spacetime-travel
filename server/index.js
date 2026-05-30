import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVisit, deleteVisit, getAtlas, updateVisit } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '..', 'dist');
const app = express();
const port = Number(process.env.PORT || 5174);

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/api/atlas', (_request, response) => {
  response.json(getAtlas());
});

app.post('/api/visits', (request, response, next) => {
  try {
    const result = createVisit(request.body);
    response.status(201).json({ ok: true, ...result, atlas: getAtlas() });
  } catch (error) {
    next(error);
  }
});

app.put('/api/visits/:id', (request, response, next) => {
  try {
    const result = updateVisit(Number(request.params.id), request.body);
    response.json({ ok: true, ...result, atlas: getAtlas() });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/visits/:id', (request, response, next) => {
  try {
    const result = deleteVisit(Number(request.params.id));
    response.json({ ok: true, ...result, atlas: getAtlas() });
  } catch (error) {
    next(error);
  }
});

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*splat}', (_request, response) => {
    response.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use((error, _request, response, _next) => {
  const status = error.status || 500;
  response.status(status).json({
    error: status === 500 ? '服务器暂时不可用' : error.message
  });
});

app.listen(port, () => {
  console.log(`spacetime-travel API listening on http://localhost:${port}`);
});
