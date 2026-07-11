import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DWELL_DURATION_MS,
  TRAVEL_DURATION_MS,
  buildMovieSegments,
  dwellCaptionOpacity,
  locateSegment,
  totalDurationMs
} from './timeline';

describe('buildMovieSegments', () => {
  it('returns an empty list for zero visits', () => {
    assert.deepEqual(buildMovieSegments(0), []);
  });

  it('alternates dwell and travel, ending on dwell', () => {
    const segments = buildMovieSegments(3);
    assert.equal(segments.length, 5);
    assert.deepEqual(
      segments.map((segment) => segment.phase),
      ['dwell', 'travel', 'dwell', 'travel', 'dwell']
    );
    assert.equal(segments[0].durationMs, DWELL_DURATION_MS);
    assert.equal(segments[1].durationMs, TRAVEL_DURATION_MS);
    assert.equal(segments[1].legIndex, 0);
    assert.equal(segments[4].legIndex, null);
  });
});

describe('locateSegment', () => {
  it('finds phase boundaries across the timeline', () => {
    const segments = buildMovieSegments(2);
    const total = totalDurationMs(segments);
    assert.equal(total, DWELL_DURATION_MS * 2 + TRAVEL_DURATION_MS);

    const first = locateSegment(segments, 0);
    assert.equal(first.segmentIndex, 0);
    assert.equal(first.segment.phase, 'dwell');
    assert.equal(first.segmentElapsedMs, 0);

    const travel = locateSegment(segments, DWELL_DURATION_MS);
    assert.equal(travel.segmentIndex, 1);
    assert.equal(travel.segment.phase, 'travel');
    assert.equal(travel.segmentElapsedMs, 0);

    const last = locateSegment(segments, total);
    assert.equal(last.segmentIndex, segments.length - 1);
    assert.equal(last.segment.phase, 'dwell');
    assert.equal(last.segmentElapsedMs, DWELL_DURATION_MS);
  });

  it('clamps elapsed time below zero to the first segment', () => {
    const segments = buildMovieSegments(1);
    const located = locateSegment(segments, -100);
    assert.equal(located.segmentIndex, 0);
    assert.equal(located.segmentElapsedMs, 0);
  });
});

describe('dwellCaptionOpacity', () => {
  it('fades in, holds, then fades out', () => {
    assert.equal(dwellCaptionOpacity(0, DWELL_DURATION_MS), 0);
    assert.ok(dwellCaptionOpacity(300, DWELL_DURATION_MS) > 0);
    assert.ok(dwellCaptionOpacity(300, DWELL_DURATION_MS) < 1);
    assert.equal(dwellCaptionOpacity(1000, DWELL_DURATION_MS), 1);
    assert.ok(dwellCaptionOpacity(DWELL_DURATION_MS - 200, DWELL_DURATION_MS) < 1);
    assert.equal(dwellCaptionOpacity(DWELL_DURATION_MS, DWELL_DURATION_MS), 0);
  });
});
