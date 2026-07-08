/** Stable year → color mapping shared by UI. Server mirrors the same palette. */
export const YEAR_PALETTE = [
  '#dd6f5c',
  '#2d7c89',
  '#6d8f58',
  '#5b6bb5',
  '#c45c26',
  '#8b5a7c',
  '#3d8b8b',
  '#a46c21'
] as const;

export const YEAR_PALETTE_EPOCH = 2018;

export function visitYear(arrivedAt: string): number {
  return Number(String(arrivedAt).slice(0, 4));
}

export function yearColor(year: number): string {
  const index = Math.abs(year - YEAR_PALETTE_EPOCH) % YEAR_PALETTE.length;
  return YEAR_PALETTE[index];
}

export function buildYearColors(years: number[]): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const year of years) {
    colors[String(year)] = yearColor(year);
  }
  return colors;
}
