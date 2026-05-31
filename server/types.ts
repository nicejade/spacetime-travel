export interface HttpError extends Error {
  status?: number;
}

export interface VisitPayloadInput {
  tripId?: number | 'new' | string;
  newTripTitle?: string;
  newTripSubtitle?: string;
  tripColor?: string;
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
  tripId: number | 'new' | null;
  newTripTitle: string;
  newTripSubtitle: string;
  tripColor: string;
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
