import { easeOutCubic } from './easing';
import type { MovieSegment } from './types';

export const DWELL_DURATION_MS = 2500;
export const TRAVEL_DURATION_MS = 3500;

export function buildMovieSegments(visitCount: number): MovieSegment[] {
  const segments: MovieSegment[] = [];

  for (let visitIndex = 0; visitIndex < visitCount; visitIndex += 1) {
    segments.push({
      phase: 'dwell',
      durationMs: DWELL_DURATION_MS,
      visitIndex,
      legIndex: null
    });

    if (visitIndex < visitCount - 1) {
      segments.push({
        phase: 'travel',
        durationMs: TRAVEL_DURATION_MS,
        visitIndex,
        legIndex: visitIndex
      });
    }
  }

  return segments;
}

export function totalDurationMs(segments: MovieSegment[]): number {
  return segments.reduce((sum, segment) => sum + segment.durationMs, 0);
}

export function locateSegment(
  segments: MovieSegment[],
  elapsedMs: number
): { segment: MovieSegment; segmentIndex: number; segmentElapsedMs: number } {
  const clamped = Math.max(0, Math.min(elapsedMs, totalDurationMs(segments)));
  let cursor = 0;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const next = cursor + segment.durationMs;
    if (clamped < next || index === segments.length - 1) {
      return {
        segment,
        segmentIndex: index,
        segmentElapsedMs: Math.min(clamped - cursor, segment.durationMs)
      };
    }
    cursor = next;
  }

  const last = segments[segments.length - 1];
  return {
    segment: last,
    segmentIndex: segments.length - 1,
    segmentElapsedMs: last.durationMs
  };
}

export function dwellCaptionOpacity(segmentElapsedMs: number, durationMs: number): number {
  const fadeInMs = 600;
  const fadeOutMs = 400;

  if (segmentElapsedMs < fadeInMs) {
    return easeOutCubic(segmentElapsedMs / fadeInMs);
  }

  if (segmentElapsedMs > durationMs - fadeOutMs) {
    return easeOutCubic((durationMs - segmentElapsedMs) / fadeOutMs);
  }

  return 1;
}
