import type Database from 'better-sqlite3';
import type { ParsedVisitPayload } from '../types.js';
import { ensureLocation } from './location.js';

export interface LegRow {
  id: number;
  from_visit_id: number;
  to_visit_id: number;
  transport: string;
  duration_hours: number | null;
  distance_km: number | null;
  note: string;
  sequence: number;
}

export interface DbVisitRow {
  id: number;
  location_id: number;
  origin_location_id: number;
  returns_to_origin: number;
  outbound_transport: string;
  outbound_note: string;
  return_transport: string | null;
  return_note: string;
  inbound_transport: string | null;
  inbound_note: string | null;
  sequence: number;
  arrived_at: string;
  departed_at: string | null;
  feeling: string;
  food: string;
  rating: number;
  mood: string;
  weather: string;
  memory: string;
  tags: string;
}

export interface VisitRow {
  id: number;
  location_id: number;
  origin_location_id: number;
  returns_to_origin: number;
  outbound_transport: string;
  outbound_note: string;
  return_transport: string | null;
  return_note: string;
  inbound_transport: string | null;
  inbound_note: string | null;
  arrived_at: string;
  departed_at: string | null;
  feeling: string;
  food: string;
  rating: number;
  mood: string;
  weather: string;
  memory: string;
  tags: string;
  sequence: number;
  location_name: string;
  country: string;
  lat: number;
  lng: number;
  kind: string;
  origin_id: number;
  origin_name: string;
  origin_country: string;
  origin_lat: number;
  origin_lng: number;
  origin_kind: string;
}

export type NormalizedVisit = ReturnType<typeof normalizeVisit>;
export type NormalizedLeg = ReturnType<typeof normalizeLeg>;

const VISIT_LIST_SQL = `
  SELECT
    visits.*,
    dest.name AS location_name,
    dest.country,
    dest.lat,
    dest.lng,
    dest.kind,
    orig.id AS origin_id,
    orig.name AS origin_name,
    orig.country AS origin_country,
    orig.lat AS origin_lat,
    orig.lng AS origin_lng,
    orig.kind AS origin_kind
  FROM visits
  JOIN locations dest ON dest.id = visits.location_id
  JOIN locations orig ON orig.id = visits.origin_location_id
  ORDER BY visits.sequence ASC, visits.arrived_at ASC, visits.id ASC
`;

export function normalizeVisit(row: VisitRow) {
  return {
    id: row.id,
    arrivedAt: row.arrived_at,
    departedAt: row.departed_at,
    feeling: row.feeling,
    food: row.food,
    rating: row.rating,
    mood: row.mood,
    weather: row.weather,
    memory: row.memory,
    tags: row.tags,
    sequence: row.sequence,
    returnsToOrigin: Boolean(row.returns_to_origin),
    outboundTransport: row.outbound_transport,
    outboundNote: row.outbound_note,
    returnTransport: row.return_transport,
    returnNote: row.return_note,
    inboundTransport: row.inbound_transport,
    inboundNote: row.inbound_note,
    location: {
      id: row.location_id,
      name: row.location_name,
      country: row.country,
      lat: row.lat,
      lng: row.lng,
      kind: row.kind
    },
    origin: {
      id: row.origin_id,
      name: row.origin_name,
      country: row.origin_country,
      lat: row.origin_lat,
      lng: row.origin_lng,
      kind: row.origin_kind
    }
  };
}

export function normalizeLeg(leg: LegRow) {
  return {
    id: leg.id,
    fromVisitId: leg.from_visit_id,
    toVisitId: leg.to_visit_id,
    transport: leg.transport,
    durationHours: leg.duration_hours,
    distanceKm: leg.distance_km,
    note: leg.note,
    sequence: leg.sequence
  };
}

export function listVisitRows(db: Database.Database): VisitRow[] {
  return db.prepare(VISIT_LIST_SQL).all() as VisitRow[];
}

export function listLegRows(db: Database.Database): LegRow[] {
  return db.prepare('SELECT * FROM legs ORDER BY sequence ASC').all() as LegRow[];
}

export function listOriginSuggestions(db: Database.Database) {
  return db
    .prepare(
      `SELECT DISTINCT l.id, l.name, l.country, l.lat, l.lng, l.kind
       FROM locations l
       JOIN visits v ON v.origin_location_id = l.id
       ORDER BY l.name ASC`
    )
    .all() as {
    id: number;
    name: string;
    country: string;
    lat: number;
    lng: number;
    kind: string;
  }[];
}

export function findVisitById(db: Database.Database, visitId: number): DbVisitRow | undefined {
  return db.prepare('SELECT * FROM visits WHERE id = ?').get(visitId) as DbVisitRow | undefined;
}

export function insertParsedVisit(db: Database.Database, payload: ParsedVisitPayload): number {
  const locationId = ensureLocation(db, {
    name: payload.locationName,
    country: payload.country,
    lat: payload.lat,
    lng: payload.lng,
    kind: 'city'
  });

  const originLocationId = ensureLocation(db, {
    name: payload.originName,
    country: payload.originCountry,
    lat: payload.originLat,
    lng: payload.originLng,
    kind: 'city'
  });

  return Number(
    db
      .prepare(
        `
      INSERT INTO visits (
        location_id, origin_location_id, returns_to_origin,
        outbound_transport, outbound_note, return_transport, return_note,
        inbound_transport, inbound_note,
        arrived_at, departed_at, feeling, food, rating, mood, weather, memory, tags, sequence
      )
      VALUES (
        @locationId, @originLocationId, @returnsToOrigin,
        @outboundTransport, @outboundNote, @returnTransport, @returnNote,
        @inboundTransport, @inboundNote,
        @arrivedAt, @departedAt, @feeling, @food, @rating, @mood, @weather, @memory, @tags, @sequence
      )
    `
      )
      .run({
        locationId,
        originLocationId,
        returnsToOrigin: payload.returnsToOrigin ? 1 : 0,
        outboundTransport: payload.outboundTransport,
        outboundNote: payload.outboundNote,
        returnTransport: payload.returnTransport,
        returnNote: payload.returnNote,
        inboundTransport: payload.inboundTransport,
        inboundNote: payload.inboundNote,
        arrivedAt: payload.arrivedAt,
        departedAt: payload.departedAt,
        feeling: payload.feeling,
        food: payload.food,
        rating: payload.rating,
        mood: payload.mood,
        weather: payload.weather,
        memory: payload.memory,
        tags: payload.tags,
        sequence: 0
      }).lastInsertRowid
  );
}

export function updateVisitRow(
  db: Database.Database,
  visitId: number,
  payload: ParsedVisitPayload
): { locationId: number; originLocationId: number } {
  const locationId = ensureLocation(db, {
    name: payload.locationName,
    country: payload.country,
    lat: payload.lat,
    lng: payload.lng,
    kind: 'city'
  });

  const originLocationId = ensureLocation(db, {
    name: payload.originName,
    country: payload.originCountry,
    lat: payload.originLat,
    lng: payload.originLng,
    kind: 'city'
  });

  db.prepare(
    `
      UPDATE visits
      SET
        location_id = @locationId,
        origin_location_id = @originLocationId,
        returns_to_origin = @returnsToOrigin,
        outbound_transport = @outboundTransport,
        outbound_note = @outboundNote,
        return_transport = @returnTransport,
        return_note = @returnNote,
        inbound_transport = @inboundTransport,
        inbound_note = @inboundNote,
        arrived_at = @arrivedAt,
        departed_at = @departedAt,
        feeling = @feeling,
        food = @food,
        rating = @rating,
        mood = @mood,
        weather = @weather,
        memory = @memory,
        tags = @tags,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @visitId
    `
  ).run({
    visitId,
    locationId,
    originLocationId,
    returnsToOrigin: payload.returnsToOrigin ? 1 : 0,
    outboundTransport: payload.outboundTransport,
    outboundNote: payload.outboundNote,
    returnTransport: payload.returnTransport,
    returnNote: payload.returnNote,
    inboundTransport: payload.inboundTransport,
    inboundNote: payload.inboundNote,
    arrivedAt: payload.arrivedAt,
    departedAt: payload.departedAt,
    feeling: payload.feeling,
    food: payload.food,
    rating: payload.rating,
    mood: payload.mood,
    weather: payload.weather,
    memory: payload.memory,
    tags: payload.tags
  });

  return { locationId, originLocationId };
}

export function deleteVisitRow(db: Database.Database, visitId: number): void {
  db.prepare('DELETE FROM legs WHERE from_visit_id = ? OR to_visit_id = ?').run(visitId, visitId);
  db.prepare('DELETE FROM visits WHERE id = ?').run(visitId);
}

export function clearAllAtlasData(db: Database.Database): void {
  db.prepare('DELETE FROM legs').run();
  db.prepare('DELETE FROM visits').run();
  db.prepare('DELETE FROM locations').run();
}
