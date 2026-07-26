import type { FastifyReply, FastifyRequest } from 'fastify';
import type { VisitPayloadInput } from '../types.js';
import { createVisit, deleteVisit, updateVisit, withAtlas } from '../services/visitService.js';
import { parseVisitId } from '../visitValidation.js';

type VisitParams = { id: string };

export async function createVisitHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = createVisit(request.body as VisitPayloadInput);
  return reply.status(201).send(withAtlas(result));
}

export async function updateVisitHandler(
  request: FastifyRequest<{ Params: VisitParams }>,
  _reply: FastifyReply
) {
  const visitId = parseVisitId(request.params.id);
  const result = updateVisit(visitId, request.body as VisitPayloadInput);
  return withAtlas(result);
}

export async function deleteVisitHandler(
  request: FastifyRequest<{ Params: VisitParams }>,
  _reply: FastifyReply
) {
  const visitId = parseVisitId(request.params.id);
  const result = deleteVisit(visitId);
  return withAtlas(result);
}
