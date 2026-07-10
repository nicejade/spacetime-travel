export type Transport = 'flight' | 'train' | 'ferry' | 'drive' | 'bus' | 'walk';

export interface Location {
  id: number;
  name: string;
  country: string;
  lat: number;
  lng: number;
  kind: string;
}

export interface Visit {
  id: number;
  arrivedAt: string;
  departedAt: string | null;
  feeling: string;
  food: string;
  rating: number;
  mood: string;
  weather: string;
  memory: string;
  tags: string;
  sequence: number;
  location: Location;
  origin: Location;
  returnsToOrigin: boolean;
  outboundTransport: string;
  outboundNote: string;
  returnTransport: string | null;
  returnNote: string;
  inboundTransport: string | null;
  inboundNote: string | null;
}

export interface VisitRoute {
  visitId: number;
  kind: 'outbound' | 'return';
  from: Location;
  to: Location;
  transport: string;
  note: string;
}

export interface Leg {
  id: number;
  fromVisitId: number;
  toVisitId: number;
  transport: string;
  durationHours: number | null;
  distanceKm: number | null;
  note: string;
  sequence: number;
}

export interface AtlasStats {
  visitCount: number;
  countryCount: number;
  averageRating: number;
  startYear: number | null;
  endYear: number | null;
}

export interface Atlas {
  visits: Visit[];
  legs: Leg[];
  visitRoutes: VisitRoute[];
  originSuggestions: Location[];
  years: number[];
  yearColors: Record<string, string>;
  stats: AtlasStats;
}

export interface VisitPayload {
  locationName: string;
  country: string;
  lat: number | string;
  lng: number | string;
  arrivedAt: string;
  departedAt?: string;
  originName: string;
  originCountry: string;
  originLat: number | string;
  originLng: number | string;
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

export interface VisitMutationResult {
  ok: boolean;
  visitId: number;
  atlas: Atlas;
}

export interface ApiErrorBody {
  error?: string;
}
