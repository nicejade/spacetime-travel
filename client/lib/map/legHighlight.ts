import type { Leg } from '$lib/types';

export type LegHighlight = 'active' | 'dimmed';

export type MovieActiveLeg = {
  fromVisitId: number;
  toVisitId: number;
};

/**
 * Decide whether a leg should be emphasized or faded for the current selection /
 * movie frame. Returns null when the default route styling should be kept.
 */
export function legHighlight(
  leg: Pick<Leg, 'fromVisitId' | 'toVisitId'>,
  selectedVisitId: number | null,
  movieMode: boolean,
  movieActiveLeg: MovieActiveLeg | null
): LegHighlight | null {
  if (movieMode) {
    if (!movieActiveLeg) return 'dimmed';
    return leg.fromVisitId === movieActiveLeg.fromVisitId &&
      leg.toVisitId === movieActiveLeg.toVisitId
      ? 'active'
      : 'dimmed';
  }

  if (selectedVisitId == null) return null;

  return leg.fromVisitId === selectedVisitId || leg.toVisitId === selectedVisitId
    ? 'active'
    : 'dimmed';
}

/** Soften outbound/return polylines relative to the selected visit. */
export function visitRouteOpacity(
  routeVisitId: number,
  kind: 'outbound' | 'return',
  selectedVisitId: number | null,
  movieMode: boolean
): number {
  const base = kind === 'return' ? 0.2 : 0.3;
  if (movieMode || selectedVisitId == null) return base;
  return routeVisitId === selectedVisitId ? Math.min(1, base + 0.35) : Math.max(0.08, base * 0.45);
}
