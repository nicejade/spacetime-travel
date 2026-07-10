import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeStatsSnapshot } from './compute';
import { filterVisits } from './filter';
import type { Visit } from '$lib/types';

function makeVisit(overrides: Partial<Visit> & Pick<Visit, 'id' | 'arrivedAt' | 'location'>): Visit {
  const origin = overrides.origin ?? {
    id: 99,
    name: '家',
    country: '中国',
    lat: 30.27,
    lng: 120.15,
    kind: 'city'
  };
  return {
    departedAt: null,
    feeling: '',
    food: '',
    rating: 4,
    mood: '',
    weather: '',
    memory: '',
    tags: '',
    sequence: overrides.id,
    origin,
    returnsToOrigin: true,
    outboundTransport: 'flight',
    outboundNote: '',
    returnTransport: null,
    returnNote: '',
    inboundTransport: null,
    inboundNote: null,
    ...overrides
  };
}

describe('filterVisits', () => {
  const visits = [
    makeVisit({
      id: 1,
      arrivedAt: '2023-06-01',
      location: { id: 1, name: '东京', country: '日本', lat: 0, lng: 0, kind: 'city' }
    }),
    makeVisit({
      id: 2,
      arrivedAt: '2024-03-01',
      location: { id: 2, name: '巴黎', country: '法国', lat: 0, lng: 0, kind: 'city' }
    })
  ];

  it('returns all visits when statsYear is all', () => {
    assert.equal(filterVisits(visits, 'all').length, 2);
  });

  it('filters by year', () => {
    assert.equal(filterVisits(visits, 2024).length, 1);
    assert.equal(filterVisits(visits, 2024)[0]?.location.name, '巴黎');
  });
});

describe('computeStatsSnapshot', () => {
  it('handles empty visits', () => {
    const snapshot = computeStatsSnapshot([], 'all');
    assert.equal(snapshot.isEmpty, true);
    assert.equal(snapshot.kpi.visitCount, 0);
    assert.equal(snapshot.kpi.averageRating, null);
  });

  it('aggregates countries, ratings, and tags', () => {
    const visits = [
      makeVisit({
        id: 1,
        arrivedAt: '2024-01-10',
        rating: 5,
        tags: '美食,文化',
        location: { id: 1, name: '东京', country: '日本', lat: 0, lng: 0, kind: 'city' }
      }),
      makeVisit({
        id: 2,
        arrivedAt: '2024-08-15',
        rating: 3,
        tags: '美食',
        location: { id: 2, name: '大阪', country: '日本', lat: 0, lng: 0, kind: 'city' }
      }),
      makeVisit({
        id: 3,
        arrivedAt: '2023-05-01',
        rating: 4,
        tags: '自然',
        location: { id: 3, name: '巴黎', country: '法国', lat: 0, lng: 0, kind: 'city' }
      })
    ];

    const snapshot = computeStatsSnapshot(visits, 'all', { '2023': '#aaa', '2024': '#bbb' });
    assert.equal(snapshot.kpi.visitCount, 3);
    assert.equal(snapshot.kpi.countryCount, 2);
    assert.equal(snapshot.kpi.averageRating, 4);
    assert.equal(snapshot.timeTrend.mode, 'yearly');
    assert.equal(snapshot.timeTrend.bars.length, 2);
    assert.match(snapshot.timeTrend.summary, /最活跃/);
    assert.equal(snapshot.geo.countries[0]?.label, '日本');
    assert.equal(snapshot.geo.countries[0]?.value, 2);
    assert.equal(snapshot.tags.uniqueCount, 3);
    assert.equal(snapshot.tags.totalMarks, 4);
    assert.equal(snapshot.tags.tags[0]?.label, '美食');
    assert.equal(snapshot.rating.hasRatings, true);
    assert.equal(snapshot.rating.yearlyAverage.length, 2);
  });

  it('uses monthly bars for a single year filter', () => {
    const visits = [
      makeVisit({
        id: 1,
        arrivedAt: '2024-01-10',
        location: { id: 1, name: '东京', country: '日本', lat: 0, lng: 0, kind: 'city' }
      }),
      makeVisit({
        id: 2,
        arrivedAt: '2024-08-15',
        location: { id: 2, name: '大阪', country: '日本', lat: 0, lng: 0, kind: 'city' }
      }),
      makeVisit({
        id: 3,
        arrivedAt: '2024-08-20',
        location: { id: 3, name: '京都', country: '日本', lat: 0, lng: 0, kind: 'city' }
      })
    ];

    const snapshot = computeStatsSnapshot(visits, 2024, { '2024': '#bbb' });
    assert.equal(snapshot.timeTrend.mode, 'monthly');
    assert.equal(snapshot.timeTrend.bars.length, 12);
    assert.match(snapshot.timeTrend.summary, /2024 年 8 月最活跃/);
    assert.equal(snapshot.rating.yearlyAverage.length, 0);
  });
});
