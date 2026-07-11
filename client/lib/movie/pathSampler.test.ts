import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAP_WIDTH } from '$lib/geo';
import {
  buildRouteGeometry,
  clampPointToMap,
  sampleRouteAtProgress
} from './pathSampler';
import type { PlottedVisit } from './types';

function plotted(x: number, y: number, lng: number): PlottedVisit {
  return {
    id: 1,
    x,
    y,
    yearColor: '#dd6f5c',
    arrivedAt: '2020-01-01',
    departedAt: null,
    feeling: '',
    food: '',
    rating: 4,
    mood: '',
    weather: '',
    memory: '',
    tags: '',
    sequence: 1,
    returnsToOrigin: true,
    outboundTransport: 'flight',
    outboundNote: '',
    returnTransport: null,
    returnNote: '',
    inboundTransport: null,
    inboundNote: null,
    location: {
      id: 1,
      name: 'A',
      country: 'X',
      lat: 0,
      lng,
      kind: 'city'
    },
    origin: {
      id: 2,
      name: 'O',
      country: 'X',
      lat: 0,
      lng: 0,
      kind: 'city'
    }
  };
}

describe('buildRouteGeometry', () => {
  it('uses a single bezier when the route does not cross the dateline', () => {
    const geometry = buildRouteGeometry(plotted(100, 100, 120), plotted(200, 150, 130), 0);
    assert.equal(geometry.segments.length, 1);
    assert.match(geometry.d, /^M /);
    assert.equal(geometry.d.includes(' Q '), true);
  });

  it('splits into two segments when longitude delta exceeds 180', () => {
    const geometry = buildRouteGeometry(plotted(100, 200, 170), plotted(2200, 220, -170), 0);
    assert.equal(geometry.segments.length, 2);
    assert.equal(geometry.segments[0].p2.x, MAP_WIDTH);
    assert.equal(geometry.segments[1].p0.x, 0);
  });

  it('splits westward when traveling across the dateline the other way', () => {
    const geometry = buildRouteGeometry(plotted(2200, 220, -170), plotted(100, 200, 170), 1);
    assert.equal(geometry.segments.length, 2);
    assert.equal(geometry.segments[0].p2.x, 0);
    assert.equal(geometry.segments[1].p0.x, MAP_WIDTH);
  });
});

describe('sampleRouteAtProgress', () => {
  it('returns the start and end points at 0 and 1', () => {
    const { segments } = buildRouteGeometry(plotted(10, 20, 0), plotted(110, 80, 10), 0);
    const start = sampleRouteAtProgress(segments, 0);
    const end = sampleRouteAtProgress(segments, 1);
    assert.equal(start.point.x, 10);
    assert.equal(start.point.y, 20);
    assert.equal(end.point.x, 110);
    assert.equal(end.point.y, 80);
  });

  it('handles an empty segment list', () => {
    const sample = sampleRouteAtProgress([], 0.5);
    assert.deepEqual(sample.point, { x: 0, y: 0 });
  });
});

describe('clampPointToMap', () => {
  it('clamps coordinates into the map bounds', () => {
    assert.deepEqual(clampPointToMap({ x: -10, y: 5000 }), { x: 0, y: 1200 });
  });
});
