import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mapPath,
  normalizePathname,
  parseRoute,
  parseStatsYear,
  pathForRoute,
  statsPath
} from './router';

describe('normalizePathname', () => {
  it('keeps root and strips trailing slashes', () => {
    assert.equal(normalizePathname('/'), '/');
    assert.equal(normalizePathname(''), '/');
    assert.equal(normalizePathname('/stats'), '/stats');
    assert.equal(normalizePathname('/stats/'), '/stats');
    assert.equal(normalizePathname('/stats///'), '/stats');
  });
});

describe('parseStatsYear', () => {
  it('defaults to all for missing or invalid values', () => {
    assert.equal(parseStatsYear(''), 'all');
    assert.equal(parseStatsYear('?'), 'all');
    assert.equal(parseStatsYear('year=all'), 'all');
    assert.equal(parseStatsYear('?year='), 'all');
    assert.equal(parseStatsYear('?year=abc'), 'all');
    assert.equal(parseStatsYear('?year=99'), 'all');
    assert.equal(parseStatsYear('?year=10000'), 'all');
  });

  it('accepts four-digit years', () => {
    assert.equal(parseStatsYear('?year=2024'), 2024);
    assert.equal(parseStatsYear('year=1999'), 1999);
  });
});

describe('parseRoute', () => {
  it('maps known paths', () => {
    assert.deepEqual(parseRoute('/'), { name: 'map' });
    assert.deepEqual(parseRoute('/stats'), { name: 'stats', year: 'all' });
    assert.deepEqual(parseRoute('/stats/', '?year=2023'), { name: 'stats', year: 2023 });
  });

  it('falls back to map for unknown paths', () => {
    assert.deepEqual(parseRoute('/unknown'), { name: 'map' });
    assert.deepEqual(parseRoute('/stats/extra'), { name: 'map' });
  });
});

describe('path builders', () => {
  it('builds map and stats URLs', () => {
    assert.equal(mapPath(), '/');
    assert.equal(statsPath(), '/stats');
    assert.equal(statsPath('all'), '/stats');
    assert.equal(statsPath(2024), '/stats?year=2024');
    assert.equal(pathForRoute({ name: 'map' }), '/');
    assert.equal(pathForRoute({ name: 'stats', year: 'all' }), '/stats');
    assert.equal(pathForRoute({ name: 'stats', year: 2021 }), '/stats?year=2021');
  });
});
