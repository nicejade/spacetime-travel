import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  YEAR_PALETTE,
  YEAR_PALETTE_EPOCH,
  buildYearColors,
  visitYear,
  yearColor
} from './years.js';

describe('shared years', () => {
  it('parses the year from an ISO date', () => {
    assert.equal(visitYear('2024-06-01'), 2024);
  });

  it('maps years to a stable palette color', () => {
    assert.equal(yearColor(YEAR_PALETTE_EPOCH), YEAR_PALETTE[0]);
    assert.equal(yearColor(YEAR_PALETTE_EPOCH + YEAR_PALETTE.length), YEAR_PALETTE[0]);
    assert.equal(yearColor(2019), YEAR_PALETTE[1]);
  });

  it('builds a string-keyed color map', () => {
    assert.deepEqual(buildYearColors([2019, 2024]), {
      '2019': yearColor(2019),
      '2024': yearColor(2024)
    });
  });
});
