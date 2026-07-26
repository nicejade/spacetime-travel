import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import type { HttpError } from '../types.js';

/**
 * Map domain / Fastify errors to a consistent JSON body.
 * Domain code sets `status` or `statusCode` via `httpError()`.
 */
export function errorHandler(
  error: FastifyError | HttpError,
  _request: FastifyRequest,
  reply: FastifyReply
) {
  const domainStatus = 'status' in error ? error.status : undefined;
  const status = domainStatus ?? error.statusCode ?? 500;
  return reply.code(status).send({
    error: status === 500 ? '服务器暂时不可用' : error.message
  });
}
