import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  adjacentVisitId,
  isTypingTarget,
  resolveShortcut,
  type ShortcutContext
} from './shortcuts';

function keyEvent(partial: {
  key: string;
  code?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}): KeyboardEvent {
  return {
    key: partial.key,
    code: partial.code ?? '',
    metaKey: partial.metaKey ?? false,
    ctrlKey: partial.ctrlKey ?? false,
    altKey: partial.altKey ?? false
  } as KeyboardEvent;
}

const mapIdle: ShortcutContext = {
  movieActive: false,
  movieExporting: false,
  modalOpen: false,
  typing: false,
  mapInteractive: true
};

describe('isTypingTarget', () => {
  it('detects editable elements', () => {
    assert.equal(isTypingTarget({ tagName: 'INPUT' } as Element), true);
    assert.equal(isTypingTarget({ tagName: 'TEXTAREA' } as Element), true);
    assert.equal(isTypingTarget({ tagName: 'SELECT' } as Element), true);
    assert.equal(
      isTypingTarget({ tagName: 'DIV', closest: (sel: string) => (sel === '[contenteditable]' ? {} : null) } as Element),
      true
    );
  });

  it('returns false for ordinary elements and null', () => {
    assert.equal(
      isTypingTarget({ tagName: 'DIV', closest: () => null } as unknown as Element),
      false
    );
    assert.equal(isTypingTarget(null), false);
  });
});

describe('resolveShortcut', () => {
  it('maps zoom and navigation keys in map mode', () => {
    assert.deepEqual(resolveShortcut(keyEvent({ key: '+' }), mapIdle), { type: 'zoom-in' });
    assert.deepEqual(resolveShortcut(keyEvent({ key: '=' }), mapIdle), { type: 'zoom-in' });
    assert.deepEqual(resolveShortcut(keyEvent({ key: 'Add' }), mapIdle), { type: 'zoom-in' });
    assert.deepEqual(resolveShortcut(keyEvent({ key: '-' }), mapIdle), { type: 'zoom-out' });
    assert.deepEqual(resolveShortcut(keyEvent({ key: 'Subtract' }), mapIdle), { type: 'zoom-out' });
    assert.deepEqual(resolveShortcut(keyEvent({ key: '0' }), mapIdle), { type: 'zoom-reset' });
    assert.deepEqual(resolveShortcut(keyEvent({ key: 'ArrowLeft' }), mapIdle), { type: 'prev-visit' });
    assert.deepEqual(resolveShortcut(keyEvent({ key: 'ArrowRight' }), mapIdle), { type: 'next-visit' });
    assert.deepEqual(resolveShortcut(keyEvent({ key: 'n' }), mapIdle), { type: 'create-visit' });
    assert.deepEqual(resolveShortcut(keyEvent({ key: 'N' }), mapIdle), { type: 'create-visit' });
  });

  it('handles movie Space and Escape only', () => {
    const movie = { ...mapIdle, movieActive: true };
    assert.deepEqual(resolveShortcut(keyEvent({ key: ' ', code: 'Space' }), movie), {
      type: 'movie-toggle-pause'
    });
    assert.deepEqual(resolveShortcut(keyEvent({ key: 'Escape' }), movie), { type: 'movie-stop' });
    assert.equal(resolveShortcut(keyEvent({ key: '+' }), movie), null);
    assert.equal(resolveShortcut(keyEvent({ key: 'ArrowRight' }), movie), null);
    assert.equal(resolveShortcut(keyEvent({ key: 'n' }), movie), null);
  });

  it('suppresses shortcuts while typing, modal, exporting, or stats', () => {
    assert.equal(resolveShortcut(keyEvent({ key: '+' }), { ...mapIdle, typing: true }), null);
    assert.equal(resolveShortcut(keyEvent({ key: ' ' }), { ...mapIdle, movieActive: true, typing: true }), null);
    assert.equal(resolveShortcut(keyEvent({ key: '+' }), { ...mapIdle, modalOpen: true }), null);
    assert.equal(
      resolveShortcut(keyEvent({ key: ' ' }), { ...mapIdle, movieActive: true, movieExporting: true }),
      null
    );
    assert.equal(resolveShortcut(keyEvent({ key: 'n' }), { ...mapIdle, mapInteractive: false }), null);
  });

  it('ignores modified key chords', () => {
    assert.equal(resolveShortcut(keyEvent({ key: 'n', metaKey: true }), mapIdle), null);
    assert.equal(resolveShortcut(keyEvent({ key: '+', ctrlKey: true }), mapIdle), null);
    assert.equal(resolveShortcut(keyEvent({ key: 'ArrowRight', altKey: true }), mapIdle), null);
  });
});

describe('adjacentVisitId', () => {
  const ids = [10, 20, 30];

  it('moves within bounds without wrapping', () => {
    assert.equal(adjacentVisitId(ids, 20, 1), 30);
    assert.equal(adjacentVisitId(ids, 20, -1), 10);
    assert.equal(adjacentVisitId(ids, 10, -1), 10);
    assert.equal(adjacentVisitId(ids, 30, 1), 30);
  });

  it('picks an edge when nothing is selected', () => {
    assert.equal(adjacentVisitId(ids, null, 1), 10);
    assert.equal(adjacentVisitId(ids, null, -1), 30);
    assert.equal(adjacentVisitId([], null, 1), null);
  });
});
