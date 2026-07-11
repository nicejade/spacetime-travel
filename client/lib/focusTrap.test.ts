import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveTabTarget } from './focusTrap';

function el(id: string): HTMLElement {
  return { id } as HTMLElement;
}

describe('resolveTabTarget', () => {
  it('returns null when browser should handle normal Tab within the list', () => {
    const a = el('a');
    const b = el('b');
    const c = el('c');
    assert.equal(resolveTabTarget([a, b, c], a, false), null);
    assert.equal(resolveTabTarget([a, b, c], b, true), null);
  });

  it('wraps forward from the last focusable to the first', () => {
    const a = el('a');
    const b = el('b');
    assert.equal(resolveTabTarget([a, b], b, false), a);
  });

  it('wraps backward from the first focusable to the last', () => {
    const a = el('a');
    const b = el('b');
    assert.equal(resolveTabTarget([a, b], a, true), b);
  });

  it('focuses an edge when active element is outside the trap', () => {
    const a = el('a');
    const b = el('b');
    const outside = el('outside');
    assert.equal(resolveTabTarget([a, b], outside, false), a);
    assert.equal(resolveTabTarget([a, b], outside, true), b);
    assert.equal(resolveTabTarget([a, b], null, false), a);
  });

  it('returns null for an empty focusable list', () => {
    assert.equal(resolveTabTarget([], null, false), null);
  });
});
