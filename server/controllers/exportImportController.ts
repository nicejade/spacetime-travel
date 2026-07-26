import type { FastifyReply, FastifyRequest } from 'fastify';
import { getAtlas } from '../models/atlas.js';
import { getExportDocument, importReplace } from '../services/exportImportService.js';

export async function exportHandler(_request: FastifyRequest, _reply: FastifyReply) {
  return getExportDocument();
}

export async function importHandler(request: FastifyRequest, _reply: FastifyReply) {
  const result = importReplace(request.body);
  return { ok: true, ...result, atlas: getAtlas() };
}
