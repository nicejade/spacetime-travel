import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { yearAfterSave } from './yearFilter';

describe('yearAfterSave', () => {
  it('keeps all when the current filter is all', () => {
    assert.equal(yearAfterSave('all', '2024-06-01'), 'all');
  });

  it('keeps the current year when the saved visit belongs to it', () => {
    assert.equal(yearAfterSave(2024, '2024-06-01'), 2024);
  });

  it('switches to the visit year when it differs from the filter', () => {
    assert.equal(yearAfterSave(2023, '2024-06-01'), 2024);
  });
});
