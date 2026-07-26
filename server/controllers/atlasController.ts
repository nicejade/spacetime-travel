import type { FastifyReply, FastifyRequest } from 'fastify';
import { getAtlas } from '../models/atlas.js';

export async function getAtlasHandler(_request: FastifyRequest, _reply: FastifyReply) {
  return getAtlas();
}
