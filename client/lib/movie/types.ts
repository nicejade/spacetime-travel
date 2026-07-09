import type { Leg, Visit } from '$lib/types';

export type MoviePhase = 'travel' | 'dwell';

export interface Point2D {
  x: number;
  y: number;
}

export interface CameraState {
  pan: Point2D;
  scale: number;
}

export interface PlottedVisit extends Visit {
  x: number;
  y: number;
  yearColor: string;
}

export interface MovieSegment {
  phase: MoviePhase;
  durationMs: number;
  visitIndex: number;
  legIndex: number | null;
}

export interface MovieFrameState {
  phase: MoviePhase;
  pathProgress: number;
  lightPosition: Point2D;
  camera: CameraState;
  activeVisitIndex: number;
  activeLegIndex: number | null;
  segmentProgress: number;
  globalProgress: number;
  dwellCaptionOpacity: number;
  complete: boolean;
}

export interface MovieEngineOptions {
  visits: PlottedVisit[];
  legs: Leg[];
  viewportWidth: number;
  viewportHeight: number;
}

export interface ResolvedLeg {
  leg: Leg | null;
  transport: string;
  fromIndex: number;
  toIndex: number;
}
