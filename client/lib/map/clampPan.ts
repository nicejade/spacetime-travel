export type Point2D = { x: number; y: number };

/**
 * Keep the scaled map overlapping the viewport so pan/zoom cannot drag
 * the world completely out of view.
 */
export function clampMapPan(
  pan: Point2D,
  scale: number,
  options: {
    mapWidth: number;
    mapHeight: number;
    viewportWidth: number;
    viewportHeight: number;
    /** Fraction of the viewport that must still show map content (0–0.5). */
    overlapRatio?: number;
  }
): Point2D {
  const {
    mapWidth,
    mapHeight,
    viewportWidth,
    viewportHeight,
    overlapRatio = 0.3
  } = options;

  const scaledW = mapWidth * scale;
  const scaledH = mapHeight * scale;
  const overlapX = Math.min(viewportWidth * overlapRatio, scaledW * 0.5);
  const overlapY = Math.min(viewportHeight * overlapRatio, scaledH * 0.5);

  const minX = overlapX - scaledW;
  const maxX = viewportWidth - overlapX;
  const minY = overlapY - scaledH;
  const maxY = viewportHeight - overlapY;

  return {
    x: Math.min(maxX, Math.max(minX, pan.x)),
    y: Math.min(maxY, Math.max(minY, pan.y))
  };
}

/**
 * Keep the map contained in the top-left origin frame (picker mini-map).
 * At scale 1, pan is locked to (0, 0).
 */
export function clampContainedPan(
  pan: Point2D,
  scale: number,
  options: { mapWidth: number; mapHeight: number }
): Point2D {
  const maxX = options.mapWidth * (scale - 1);
  const maxY = options.mapHeight * (scale - 1);
  return {
    x: Math.min(0, Math.max(-maxX, pan.x)) || 0,
    y: Math.min(0, Math.max(-maxY, pan.y)) || 0
  };
}
