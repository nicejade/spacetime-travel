import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { posterDisabledReason } from './preview';

describe('posterDisabledReason', () => {
  it('requires a concrete year with visits', () => {
    assert.equal(posterDisabledReason('all', 3, false), '请先选择具体年份');
    assert.equal(posterDisabledReason(2024, 0, false), '该年暂无旅行记录');
    assert.equal(posterDisabledReason(2024, 2, true), '正在生成海报…');
    assert.equal(posterDisabledReason(2024, 2, false), '');
  });
});
