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

export interface ParsedVisitPayload {
  locationName: string;
  country: string;
  lat: number;
  lng: number;
  arrivedAt: string;
  departedAt: string | null;
  transport: string;
  legNote: string;
  feeling: string;
  food: string;
  rating: number;
  mood: string;
  weather: string;
  memory: string;
  tags: string;
}
