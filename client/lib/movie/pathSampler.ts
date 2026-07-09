import { MAP_HEIGHT, MAP_WIDTH } from '$lib/geo';
import { clamp } from './easing';
import type { PlottedVisit, Point2D } from './types';

export interface QuadraticBezier {
  p0: Point2D;
  p1: Point2D;
  p2: Point2D;
}

export interface RouteGeometry {
  segments: QuadraticBezier[];
  d: string;
}

function crossesDateline(fromLng: number, toLng: number): boolean {
  return Math.abs(fromLng - toLng) > 180;
}

function normalizeLngDelta(delta: number): number {
  if (delta > 180) return delta - 360;
  if (delta < -180) return delta + 360;
  return delta;
}

function makeBezier(from: Point2D, to: Point2D, curveIndex: number): QuadraticBezier {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const curve = clamp(distance * 0.16, 34, 150);
  const direction = curveIndex % 2 === 0 ? 1 : -1;

  return {
    p0: from,
    p1: {
      x: (from.x + to.x) / 2 + (-dy / distance) * curve * direction,
      y: (from.y + to.y) / 2 + (dx / distance) * curve * direction
    },
    p2: to
  };
}

function edgePoint(x: number, y: number): Point2D {
  return { x, y };
}

export function buildRouteGeometry(
  from: PlottedVisit,
  to: PlottedVisit,
  curveIndex: number
): RouteGeometry {
  const fromPoint = { x: from.x, y: from.y };
  const toPoint = { x: to.x, y: to.y };

  if (!crossesDateline(from.location.lng, to.location.lng)) {
    const segment = makeBezier(fromPoint, toPoint, curveIndex);
    return {
      segments: [segment],
      d: bezierToPath([segment])
    };
  }

  const midY = (from.y + to.y) / 2;
  const goingEast = normalizeLngDelta(to.location.lng - from.location.lng) > 0;
  const firstEdge = goingEast ? edgePoint(MAP_WIDTH, midY) : edgePoint(0, midY);
  const secondEdge = goingEast ? edgePoint(0, midY) : edgePoint(MAP_WIDTH, midY);
  const segments = [
    makeBezier(fromPoint, firstEdge, curveIndex),
    makeBezier(secondEdge, toPoint, curveIndex + 1)
  ];

  return {
    segments,
    d: bezierToPath(segments)
  };
}

export function bezierToPath(segments: QuadraticBezier[]): string {
  return segments
    .map((segment, index) => {
      const move = index === 0 ? `M ${segment.p0.x.toFixed(2)} ${segment.p0.y.toFixed(2)}` : '';
      return `${move} Q ${segment.p1.x.toFixed(2)} ${segment.p1.y.toFixed(2)} ${segment.p2.x.toFixed(2)} ${segment.p2.y.toFixed(2)}`;
    })
    .join(' ');
}

function quadPoint(segment: QuadraticBezier, t: number): Point2D {
  const mt = 1 - t;
  return {
    x: mt * mt * segment.p0.x + 2 * mt * t * segment.p1.x + t * t * segment.p2.x,
    y: mt * mt * segment.p0.y + 2 * mt * t * segment.p1.y + t * t * segment.p2.y
  };
}

function quadTangent(segment: QuadraticBezier, t: number): Point2D {
  const mt = 1 - t;
  return {
    x: 2 * mt * (segment.p1.x - segment.p0.x) + 2 * t * (segment.p2.x - segment.p1.x),
    y: 2 * mt * (segment.p1.y - segment.p0.y) + 2 * t * (segment.p2.y - segment.p1.y)
  };
}

function approximateBezierLength(segment: QuadraticBezier, samples = 24): number {
  let length = 0;
  let previous = segment.p0;

  for (let index = 1; index <= samples; index += 1) {
    const point = quadPoint(segment, index / samples);
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }

  return length;
}

export function sampleRouteAtProgress(
  segments: QuadraticBezier[],
  progress: number
): { point: Point2D; tangent: Point2D } {
  if (segments.length === 0) {
    return { point: { x: 0, y: 0 }, tangent: { x: 1, y: 0 } };
  }

  const lengths = segments.map((segment) => approximateBezierLength(segment));
  const total = lengths.reduce((sum, value) => sum + value, 0) || 1;
  let remaining = clamp(progress, 0, 1) * total;

  for (let index = 0; index < segments.length; index += 1) {
    const length = lengths[index];
    if (remaining <= length || index === segments.length - 1) {
      const localT = length === 0 ? 0 : remaining / length;
      const segment = segments[index];
      return {
        point: quadPoint(segment, clamp(localT, 0, 1)),
        tangent: quadTangent(segment, clamp(localT, 0, 1))
      };
    }
    remaining -= length;
  }

  const last = segments[segments.length - 1];
  return { point: last.p2, tangent: { x: 1, y: 0 } };
}

export function clampPointToMap(point: Point2D): Point2D {
  return {
    x: clamp(point.x, 0, MAP_WIDTH),
    y: clamp(point.y, 0, MAP_HEIGHT)
  };
}
