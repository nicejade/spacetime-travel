import { projection } from '$lib/geo';
import type { Visit } from '$lib/types';

export interface PlottedOrigin {
  key: string;
  name: string;
  country: string;
  x: number;
  y: number;
}

export function plotOrigins(visits: Visit[]): PlottedOrigin[] {
  const map = new Map<string, PlottedOrigin>();
  for (const visit of visits) {
    const { origin } = visit;
    const key = `${origin.lat.toFixed(4)}:${origin.lng.toFixed(4)}`;
    if (map.has(key)) continue;
    const [x, y] = projection([origin.lng, origin.lat]) ?? [0, 0];
    map.set(key, { key, name: origin.name, country: origin.country, x, y });
  }
  return [...map.values()];
}
