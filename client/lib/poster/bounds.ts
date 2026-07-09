import type { PlottedVisit } from '$lib/movie/types';
import type { PosterCamera, PosterMapRegion } from './types';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function computePosterBounds(
  plottedVisits: PlottedVisit[],
  mapRegion: PosterMapRegion
): PosterCamera {
  const centerX = mapRegion.x + mapRegion.width / 2;
  const centerY = mapRegion.y + mapRegion.height / 2;

  if (plottedVisits.length === 1) {
    const visit = plottedVisits[0];
    const scale = 1.4;
    return {
      pan: {
        x: centerX - visit.x * scale,
        y: centerY - visit.y * scale
      },
      scale
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const visit of plottedVisits) {
    minX = Math.min(minX, visit.x);
    maxX = Math.max(maxX, visit.x);
    minY = Math.min(minY, visit.y);
    maxY = Math.max(maxY, visit.y);
  }

  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const padX = spanX * 0.15;
  const padY = spanY * 0.15;
  const contentWidth = spanX + padX * 2;
  const contentHeight = spanY + padY * 2;
  const scale = clamp(
    Math.min(mapRegion.width / contentWidth, mapRegion.height / contentHeight),
    0.3,
    3.0
  );
  const focusX = (minX + maxX) / 2;
  const focusY = (minY + maxY) / 2;

  return {
    pan: {
      x: centerX - focusX * scale,
      y: centerY - focusY * scale
    },
    scale
  };
}
