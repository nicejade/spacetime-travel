import type { FastifyReply, FastifyRequest } from 'fastify';

export async function getHealth(_request: FastifyRequest, _reply: FastifyReply) {
  return { ok: true };
}
