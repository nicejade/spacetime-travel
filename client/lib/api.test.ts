import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { createVisit, fetchAtlas, isAbortError, updateVisit } from './api';
import type { VisitPayload } from './types';

describe('isAbortError', () => {
  it('returns true for AbortError name', () => {
    const error = new Error('Aborted');
    error.name = 'AbortError';
    assert.equal(isAbortError(error), true);
  });

  it('returns true for DOMException AbortError when available', () => {
    if (typeof DOMException === 'undefined') return;
    assert.equal(isAbortError(new DOMException('Aborted', 'AbortError')), true);
  });

  it('returns false for ordinary errors and non-errors', () => {
    assert.equal(isAbortError(new Error('请求失败')), false);
    assert.equal(isAbortError('abort'), false);
    assert.equal(isAbortError(null), false);
  });
});

describe('api fetch signal', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.restoreAll();
  });

  it('passes AbortSignal to fetchAtlas', async () => {
    const controller = new AbortController();
    let seen: AbortSignal | undefined;

    globalThis.fetch = mock.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      seen = init?.signal ?? undefined;
      return new Response(JSON.stringify({ visits: [], legs: [], locations: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    await fetchAtlas({ signal: controller.signal });
    assert.equal(seen, controller.signal);
  });

  it('passes AbortSignal to createVisit and updateVisit', async () => {
    const controller = new AbortController();
    const signals: Array<AbortSignal | null | undefined> = [];
    const payload = { locationName: 'Tokyo' } as VisitPayload;
    const body = JSON.stringify({ visitId: 1, atlas: { visits: [], legs: [], locations: [] } });

    globalThis.fetch = mock.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      signals.push(init?.signal);
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    await createVisit(payload, { signal: controller.signal });
    await updateVisit(1, payload, { signal: controller.signal });
    assert.equal(signals[0], controller.signal);
    assert.equal(signals[1], controller.signal);
  });

  it('rejects with AbortError when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    globalThis.fetch = mock.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal?.aborted) {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        throw error;
      }
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    await assert.rejects(() => fetchAtlas({ signal: controller.signal }), (error: unknown) => {
      assert.equal(isAbortError(error), true);
      return true;
    });
  });
});
