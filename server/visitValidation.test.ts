import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertDateOrder,
  parseIsoDate,
  parseTransport,
  parseVisitId,
  TRANSPORTS
} from './visitValidation.js';
import type { HttpError } from './types.js';

function assertHttpError(fn: () => unknown, status: number, messageIncludes: string) {
  try {
    fn();
    assert.fail('expected throw');
  } catch (error) {
    const err = error as HttpError;
    assert.equal(err.status ?? err.statusCode, status);
    assert.ok(String(err.message).includes(messageIncludes), err.message);
  }
}

describe('parseIsoDate', () => {
  it('accepts YYYY-MM-DD', () => {
    assert.equal(parseIsoDate('2024-01-15', '到达时间'), '2024-01-15');
  });

  it('rejects empty', () => {
    assertHttpError(() => parseIsoDate('', '到达时间'), 400, '到达时间');
  });

  it('rejects slash format', () => {
    assertHttpError(() => parseIsoDate('2024/01/15', '到达时间'), 400, 'YYYY-MM-DD');
  });

  it('rejects impossible calendar date', () => {
    assertHttpError(() => parseIsoDate('2024-13-01', '到达时间'), 400, 'YYYY-MM-DD');
    assertHttpError(() => parseIsoDate('2024-02-30', '离开时间'), 400, 'YYYY-MM-DD');
  });
});

describe('assertDateOrder', () => {
  it('allows null departedAt', () => {
    assertDateOrder('2024-01-10', null);
  });

  it('allows same-day departure', () => {
    assertDateOrder('2024-01-10', '2024-01-10');
  });

  it('allows later departure', () => {
    assertDateOrder('2024-01-10', '2024-01-12');
  });

  it('rejects earlier departure', () => {
    assertHttpError(() => assertDateOrder('2024-01-10', '2024-01-09'), 400, '离开时间不能早于到达时间');
  });
});

describe('parseTransport', () => {
  it('accepts all whitelist values', () => {
    for (const t of TRANSPORTS) {
      assert.equal(parseTransport(t, { label: '去程交通方式', fallback: 'flight' }), t);
    }
  });

  it('uses fallback when empty', () => {
    assert.equal(parseTransport('', { label: '去程交通方式', fallback: 'flight' }), 'flight');
    assert.equal(parseTransport(undefined, { label: '去程交通方式', fallback: 'flight' }), 'flight');
  });

  it('allows empty when allowEmpty', () => {
    assert.equal(parseTransport('', { label: '返程交通方式', allowEmpty: true }), null);
    assert.equal(parseTransport('  ', { label: '站间交通方式', allowEmpty: true }), null);
  });

  it('rejects unknown transport', () => {
    assertHttpError(
      () => parseTransport('teleport', { label: '去程交通方式', fallback: 'flight' }),
      400,
      '去程交通方式无效'
    );
  });
});

describe('parseVisitId', () => {
  it('parses positive integer string', () => {
    assert.equal(parseVisitId('42'), 42);
  });

  it('rejects non-numeric', () => {
    assertHttpError(() => parseVisitId('abc'), 400, '访问 ID 无效');
  });

  it('rejects zero and negative', () => {
    assertHttpError(() => parseVisitId('0'), 400, '访问 ID 无效');
    assertHttpError(() => parseVisitId('-1'), 400, '访问 ID 无效');
  });
});
