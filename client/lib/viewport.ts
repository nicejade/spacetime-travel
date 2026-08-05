/** Narrow mode: viewport width < 1000px */
export const NARROW_VIEWPORT_MQ = '(max-width: 999px)';

export function shouldShowStatsView(isNarrow: boolean, isStatsRoute: boolean): boolean {
  return isStatsRoute && !isNarrow;
}

export function canOpenMapSurfaces(isNarrow: boolean): boolean {
  return !isNarrow;
}
