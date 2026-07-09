import type { Leg, Visit } from '$lib/types';
import type { PlottedVisit } from '$lib/movie/types';

export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1440;

export const POSTER_LAYOUT = {
  marginX: 48,
  accentHeight: 8,
  brandY: 40,
  titleY: 92,
  mapCardY: 148,
  mapCardHeight: 900,
  statsY: 1100,
  watermarkY: 1388
} as const;

export interface PosterStats {
  visitCount: number;
  countryCount: number;
  averageRating: number | null;
}

export interface PosterCamera {
  pan: { x: number; y: number };
  scale: number;
}

export interface PosterMapRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PosterBuildInput {
  year: number;
  yearColor: string;
  stats: PosterStats;
  plottedVisits: PlottedVisit[];
  legs: Leg[];
  camera: PosterCamera;
  mapRegion: PosterMapRegion;
}

export interface PosterGenerateInput {
  year: number;
  yearColor: string;
  visits: Visit[];
  legs: Leg[];
  yearColors: Record<string, string>;
}
