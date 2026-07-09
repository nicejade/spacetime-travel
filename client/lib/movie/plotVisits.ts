import { projection } from '$lib/geo';
import type { Visit } from '$lib/types';
import { visitYear } from '$lib/years';
import type { PlottedVisit } from './types';

export function plotVisits(visits: Visit[], yearColors: Record<string, string>): PlottedVisit[] {
  return visits
    .map((visit) => {
      const [x, y] = projection([visit.location.lng, visit.location.lat]) ?? [0, 0];
      const year = visitYear(visit.arrivedAt);
      return {
        ...visit,
        x,
        y,
        yearColor: yearColors[String(year)] || '#2d7c89'
      };
    })
    .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
}
