import { clamp, lerp } from './easing';
import type { CameraState, Point2D } from './types';

interface TransportRig {
  minScale: number;
  maxScale: number;
  leadDistance: number;
}

const TRANSPORT_RIGS: Record<string, TransportRig> = {
  flight: { minScale: 0.95, maxScale: 1.2, leadDistance: 120 },
  train: { minScale: 1.1, maxScale: 1.4, leadDistance: 40 },
  ferry: { minScale: 0.8, maxScale: 1.0, leadDistance: 60 },
  drive: { minScale: 1.0, maxScale: 1.3, leadDistance: 50 },
  bus: { minScale: 1.0, maxScale: 1.2, leadDistance: 50 },
  walk: { minScale: 1.3, maxScale: 1.6, leadDistance: 20 }
};

function rigFor(transport: string): TransportRig {
  return TRANSPORT_RIGS[transport] ?? TRANSPORT_RIGS.walk;
}

function normalize(vector: Point2D): Point2D {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

export function computeCameraTarget(
  lightPosition: Point2D,
  tangent: Point2D,
  transport: string,
  pathProgress: number,
  viewportWidth: number,
  viewportHeight: number
): CameraState {
  const rig = rigFor(transport);
  const direction = normalize(tangent);
  const focusPoint = {
    x: lightPosition.x + direction.x * rig.leadDistance,
    y: lightPosition.y + direction.y * rig.leadDistance
  };

  let scale = lerp(rig.minScale, rig.maxScale, 0.5);
  if (transport === 'flight') {
    scale = pathProgress < 0.5
      ? lerp(rig.maxScale, rig.minScale, pathProgress * 2)
      : lerp(rig.minScale, rig.maxScale, (pathProgress - 0.5) * 2);
  } else {
    scale = lerp(rig.minScale, rig.maxScale, pathProgress);
  }

  return {
    pan: {
      x: viewportWidth / 2 - focusPoint.x * scale,
      y: viewportHeight / 2 - focusPoint.y * scale
    },
    scale: clamp(scale, 0.42, 2.6)
  };
}

export function computeDwellCamera(
  visitPosition: Point2D,
  transport: string,
  viewportWidth: number,
  viewportHeight: number
): CameraState {
  const rig = rigFor(transport);
  const scale = (rig.minScale + rig.maxScale) / 2;

  return {
    pan: {
      x: viewportWidth / 2 - visitPosition.x * scale,
      y: viewportHeight / 2 - visitPosition.y * scale
    },
    scale: clamp(scale, 0.42, 2.6)
  };
}

export function smoothCamera(current: CameraState, target: CameraState, factor = 0.08): CameraState {
  return {
    pan: {
      x: lerp(current.pan.x, target.pan.x, factor),
      y: lerp(current.pan.y, target.pan.y, factor)
    },
    scale: lerp(current.scale, target.scale, factor)
  };
}
