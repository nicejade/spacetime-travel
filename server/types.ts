export interface HttpError extends Error {
  status?: number;
  statusCode?: number;
}

export interface VisitPayloadInput {
  locationName?: string;
  country?: string;
  lat?: number | string;
  lng?: number | string;
  arrivedAt?: string;
  departedAt?: string;
  originName?: string;
  originCountry?: string;
  originLat?: number | string;
  originLng?: number | string;
  returnsToOrigin?: boolean;
  outboundTransport?: string;
  outboundNote?: string;
  returnTransport?: string;
  returnNote?: string;
  inboundTransport?: string;
  inboundNote?: string;
  feeling?: string;
  food?: string;
  rating?: number | string;
  mood?: string;
  weather?: string;
  memory?: string;
  tags?: string;
}

export interface ParsedVisitPayload {
  locationName: string;
  country: string;
  lat: number;
  lng: number;
  arrivedAt: string;
  departedAt: string | null;
  originName: string;
  originCountry: string;
  originLat: number;
  originLng: number;
  returnsToOrigin: boolean;
  outboundTransport: string;
  outboundNote: string;
  returnTransport: string | null;
  returnNote: string;
  inboundTransport: string | null;
  inboundNote: string;
  feeling: string;
  food: string;
  rating: number;
  mood: string;
  weather: string;
  memory: string;
  tags: string;
}
