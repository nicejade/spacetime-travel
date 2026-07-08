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
  transport: string | null;
  legNote: string | null;
  location: Location;
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
  transport?: string;
  legNote?: string;
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
