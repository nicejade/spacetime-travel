import { db } from '../db/connection.js';
import { httpError } from '../lib/httpError.js';
import { getAtlas } from '../models/atlas.js';
import { purgeOrphanLocations } from '../models/location.js';
import {
  deleteVisitRow,
  findVisitById,
  insertParsedVisit,
  updateVisitRow
} from '../models/visit.js';
import { rebuildSequencesAndLegs } from './rebuildLegs.js';
import type { VisitPayloadInput } from '../types.js';
import { readVisitPayload } from './visitPayload.js';

export const createVisit = db.transaction((rawPayload: VisitPayloadInput) => {
  const payload = readVisitPayload(rawPayload);
  const visitId = insertParsedVisit(db, payload);

  rebuildSequencesAndLegs(db, {
    focusVisitId: visitId,
    focusInboundTransport: payload.inboundTransport || 'flight',
    focusInboundNote: payload.inboundNote || ''
  });

  return { visitId };
});

export const updateVisit = db.transaction((visitId: number, rawPayload: VisitPayloadInput) => {
  const payload = readVisitPayload(rawPayload);
  const current = findVisitById(db, visitId);

  if (!current) {
    throw httpError(404, '旅行节点不存在');
  }

  updateVisitRow(db, visitId, payload);
  purgeOrphanLocations(db, [current.location_id, current.origin_location_id]);

  rebuildSequencesAndLegs(db, {
    focusVisitId: visitId,
    focusInboundTransport: payload.inboundTransport || 'flight',
    focusInboundNote: payload.inboundNote || ''
  });

  return { visitId };
});

export const deleteVisit = db.transaction((visitId: number) => {
  const current = findVisitById(db, visitId);

  if (!current) {
    throw httpError(404, '旅行节点不存在');
  }

  deleteVisitRow(db, visitId);
  purgeOrphanLocations(db, [current.location_id, current.origin_location_id]);
  rebuildSequencesAndLegs(db);

  return { visitId };
});

/** Mutation responses always include a fresh atlas snapshot for the client. */
export function withAtlas<T extends Record<string, unknown>>(result: T) {
  return { ok: true as const, ...result, atlas: getAtlas() };
}
