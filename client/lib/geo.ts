import { geoContains, geoEquirectangular, geoPath } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import countries110m from 'world-atlas/countries-110m.json';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import countriesZh from './data/countries-zh.json';

/**
 * Shared map geometry used by both the main canvas and the in-form location
 * picker. Keeping a single projection instance guarantees that "click to pick"
 * coordinates round-trip exactly with the rendered node positions.
 */
export const MAP_WIDTH = 2400;
export const MAP_HEIGHT = 1200;

export const projection = geoEquirectangular().fitSize([MAP_WIDTH, MAP_HEIGHT], { type: 'Sphere' });
export const pathGenerator = geoPath(projection);

const topology = countries110m as unknown as Parameters<typeof feature>[0];
const countryCollection = feature(
  topology,
  topology.objects.countries
) as unknown as FeatureCollection<Geometry, { name?: string }>;

export const countryFeatures: Feature<Geometry, { name?: string }>[] = countryCollection.features;

const countryNameZh = countriesZh as Record<string, string>;

/**
 * Resolve the Chinese country name that contains the given point.
 * Returns an empty string for oceans / uncovered areas.
 */
export function countryAt(lng: number, lat: number): string {
  for (const country of countryFeatures) {
    if (geoContains(country as GeoPermissibleObjects, [lng, lat])) {
      const numericId = String(parseInt(String(country.id ?? ''), 10));
      return countryNameZh[numericId] || country.properties?.name || '';
    }
  }
  return '';
}
