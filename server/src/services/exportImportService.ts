import { db } from '../db/connection.js';
import { buildExportDocument, parseExportDocument, type ExportVisit } from './exportImport.js';
import { SCHEMA_VERSION } from '../db/migrations.js';
import { getAtlas } from '../models/atlas.js';
import { clearAllAtlasData, insertParsedVisit, type NormalizedVisit } from '../models/visit.js';
import { rebuildSequencesAndLegs } from './rebuildLegs.js';
import { readVisitPayload } from './visitPayload.js';

function visitToExportPayload(visit: NormalizedVisit): ExportVisit {
  return {
    locationName: visit.location.name,
    country: visit.location.country,
    lat: visit.location.lat,
    lng: visit.location.lng,
    arrivedAt: visit.arrivedAt,
    departedAt: visit.departedAt ?? undefined,
    originName: visit.origin.name,
    originCountry: visit.origin.country,
    originLat: visit.origin.lat,
    originLng: visit.origin.lng,
    returnsToOrigin: visit.returnsToOrigin,
    outboundTransport: visit.outboundTransport,
    outboundNote: visit.outboundNote,
    returnTransport: visit.returnTransport ?? undefined,
    returnNote: visit.returnNote,
    inboundTransport: visit.inboundTransport ?? undefined,
    inboundNote: visit.inboundNote ?? undefined,
    feeling: visit.feeling,
    food: visit.food,
    rating: visit.rating,
    mood: visit.mood,
    weather: visit.weather,
    memory: visit.memory,
    tags: visit.tags
  };
}

export function getExportDocument() {
  const atlas = getAtlas();
  return buildExportDocument(atlas.visits.map(visitToExportPayload));
}

/** Replace all atlas data with an exported JSON document (replace strategy). */
export const importReplace = db.transaction((raw: unknown) => {
  const parsed = parseExportDocument(raw);
  const payloads = parsed.visits.map((visit) => readVisitPayload(visit));

  clearAllAtlasData(db);

  for (const payload of payloads) {
    insertParsedVisit(db, payload);
  }

  rebuildSequencesAndLegs(db);

  return {
    schemaVersion: SCHEMA_VERSION,
    visitCount: payloads.length
  };
});
