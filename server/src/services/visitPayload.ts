import { httpError } from '../lib/httpError.js';
import type { ParsedVisitPayload, VisitPayloadInput } from '../types.js';
import { assertDateOrder, parseIsoDate, parseTransport } from './visitValidation.js';

function cleanString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.trim();
}

function cleanNumber(value: unknown, fallback: number | null = null): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanRating(value: unknown): number {
  const rating = cleanNumber(value, 4.5) ?? 4.5;
  return Math.max(1, Math.min(5, Number(rating.toFixed(1))));
}

function requireText(payload: VisitPayloadInput, key: keyof VisitPayloadInput, label: string): string {
  const value = cleanString(payload[key]);
  if (!value) {
    throw httpError(400, `${label}不能为空`);
  }
  return value;
}

function readCoords(
  payload: VisitPayloadInput,
  prefix: '' | 'origin'
): { lat: number; lng: number; name: string; country: string } {
  const latKey = prefix ? 'originLat' : 'lat';
  const lngKey = prefix ? 'originLng' : 'lng';
  const nameKey = prefix ? 'originName' : 'locationName';
  const countryKey = prefix ? 'originCountry' : 'country';
  const lat = cleanNumber(payload[latKey]);
  const lng = cleanNumber(payload[lngKey]);
  if (lat === null || lat < -90 || lat > 90) {
    throw httpError(400, '纬度需要在 -90 到 90 之间');
  }
  if (lng === null || lng < -180 || lng > 180) {
    throw httpError(400, '经度需要在 -180 到 180 之间');
  }
  return {
    lat,
    lng,
    name: requireText(payload, nameKey, prefix ? '起点' : '地点'),
    country: requireText(payload, countryKey, prefix ? '起点国家/地区' : '国家/地区')
  };
}

/** Validate and normalize a raw visit write payload. */
export function readVisitPayload(payload: VisitPayloadInput): ParsedVisitPayload {
  const destination = readCoords(payload, '');
  const origin = readCoords(payload, 'origin');

  if (destination.lat === origin.lat && destination.lng === origin.lng) {
    throw httpError(400, '起点与目的地不能相同');
  }

  const returnsToOrigin = payload.returnsToOrigin !== false;
  const arrivedAt = parseIsoDate(payload.arrivedAt, '到达时间');
  const departedRaw = typeof payload.departedAt === 'string' ? payload.departedAt.trim() : '';
  const departedAt = departedRaw ? parseIsoDate(departedRaw, '离开时间') : null;
  assertDateOrder(arrivedAt, departedAt);

  const outboundTransport = parseTransport(payload.outboundTransport, {
    label: '去程交通方式',
    fallback: 'flight'
  }) as string;

  const returnTransport = returnsToOrigin
    ? parseTransport(payload.returnTransport, { label: '返程交通方式', allowEmpty: true })
    : null;

  const inboundTransport = parseTransport(payload.inboundTransport, {
    label: '站间交通方式',
    allowEmpty: true
  });

  return {
    locationName: destination.name,
    country: destination.country,
    lat: destination.lat,
    lng: destination.lng,
    arrivedAt,
    departedAt,
    originName: origin.name,
    originCountry: origin.country,
    originLat: origin.lat,
    originLng: origin.lng,
    returnsToOrigin,
    outboundTransport,
    outboundNote: cleanString(payload.outboundNote),
    returnNote: cleanString(payload.returnNote),
    returnTransport,
    inboundTransport,
    inboundNote: cleanString(payload.inboundNote),
    feeling: cleanString(payload.feeling),
    food: cleanString(payload.food),
    rating: cleanRating(payload.rating),
    mood: cleanString(payload.mood),
    weather: cleanString(payload.weather),
    memory: cleanString(payload.memory),
    tags: cleanString(payload.tags)
  };
}
