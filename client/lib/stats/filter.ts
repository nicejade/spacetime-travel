import type { Visit } from '$lib/types';
import { visitYear } from '$lib/years';

export function filterVisits(visits: Visit[], statsYear: number | 'all'): Visit[] {
  if (statsYear === 'all') return visits;
  return visits.filter((visit) => visitYear(visit.arrivedAt) === statsYear);
}
