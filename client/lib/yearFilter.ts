import { visitYear } from './years';

/** Preserve year filter after save; switch only when the visit leaves the active year. */
export function yearAfterSave(selectedYear: number | 'all', savedArrivedAt: string): number | 'all' {
  if (selectedYear === 'all') return 'all';
  const year = visitYear(savedArrivedAt);
  return selectedYear === year ? selectedYear : year;
}
