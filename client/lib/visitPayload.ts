import type { Visit, VisitPayload } from './types';

/** Flatten a visit into the API create/update payload shape. */
export function visitToPayload(visit: Visit): VisitPayload {
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
