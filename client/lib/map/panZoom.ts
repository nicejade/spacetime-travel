import type { Point2D } from './clampPan';

/**
 * Adjust pan so the world point under `anchor` stays fixed when scale changes.
 * Used by both TravelCanvas and LocationPicker wheel zoom.
 */
export function panForZoomAt(
  pan: Point2D,
  scale: number,
  nextScale: number,
  anchor: Point2D
): Point2D {
  if (scale === nextScale) return pan;
  const worldX = (anchor.x - pan.x) / scale;
  const worldY = (anchor.y - pan.y) / scale;
  return {
    x: anchor.x - worldX * nextScale,
    y: anchor.y - worldY * nextScale
  };
}
