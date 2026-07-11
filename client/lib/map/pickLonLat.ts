import { countryAt, projection } from '$lib/geo';
import type { Point2D } from './clampPan';

export type MapViewTransform = {
  pan: Point2D;
  scale: number;
};

export type LonLatPick = {
  lat: number;
  lng: number;
  country: string;
};

/** Convert a point in viewport/shell coordinates into map (world) coordinates. */
export function viewportToMapPoint(viewport: Point2D, view: MapViewTransform): Point2D {
  return {
    x: (viewport.x - view.pan.x) / view.scale,
    y: (viewport.y - view.pan.y) / view.scale
  };
}

/**
 * Invert a viewport click into rounded lon/lat + country label.
 * Returns null when the projection cannot invert or the result is out of range.
 */
export function pickLonLatAt(viewport: Point2D, view: MapViewTransform): LonLatPick | null {
  const mapPoint = viewportToMapPoint(viewport, view);
  const inverted = projection.invert?.([mapPoint.x, mapPoint.y]);
  if (!inverted) return null;

  const [pickedLng, pickedLat] = inverted;
  if (!Number.isFinite(pickedLat) || !Number.isFinite(pickedLng)) return null;
  if (Math.abs(pickedLat) > 90 || Math.abs(pickedLng) > 180) return null;

  const lat = Number(pickedLat.toFixed(4));
  const lng = Number(pickedLng.toFixed(4));
  return {
    lat,
    lng,
    country: countryAt(lng, lat)
  };
}
