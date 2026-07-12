export type ShortcutAction =
  | { type: 'zoom-in' }
  | { type: 'zoom-out' }
  | { type: 'zoom-reset' }
  | { type: 'prev-visit' }
  | { type: 'next-visit' }
  | { type: 'create-visit' }
  | { type: 'movie-toggle-pause' }
  | { type: 'movie-stop' };

export type ShortcutContext = {
  movieActive: boolean;
  movieExporting: boolean;
  modalOpen: boolean;
  typing: boolean;
  mapInteractive: boolean;
};

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: string; closest?: (selector: string) => unknown };
  const tag = String(el.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (typeof el.closest === 'function') {
    return Boolean(el.closest('[contenteditable]'));
  }
  return false;
}

export function resolveShortcut(
  event: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey'>,
  context: ShortcutContext
): ShortcutAction | null {
  if (context.typing) return null;
  if (context.movieExporting) return null;

  if (context.movieActive) {
    if (event.key === ' ' || event.code === 'Space') return { type: 'movie-toggle-pause' };
    if (event.key === 'Escape') return { type: 'movie-stop' };
    return null;
  }

  if (context.modalOpen || !context.mapInteractive) return null;
  if (event.metaKey || event.ctrlKey || event.altKey) return null;

  switch (event.key) {
    case '+':
    case '=':
    case 'Add':
      return { type: 'zoom-in' };
    case '-':
    case 'Subtract':
      return { type: 'zoom-out' };
    case '0':
      return { type: 'zoom-reset' };
    case 'ArrowLeft':
      return { type: 'prev-visit' };
    case 'ArrowRight':
      return { type: 'next-visit' };
    case 'n':
    case 'N':
      return { type: 'create-visit' };
    default:
      return null;
  }
}

/** Clamp adjacent selection within `visitIds` order; no wrap-around. */
export function adjacentVisitId(
  visitIds: number[],
  currentId: number | null,
  delta: 1 | -1
): number | null {
  if (!visitIds.length) return null;
  if (currentId == null) {
    return delta > 0 ? visitIds[0] : visitIds[visitIds.length - 1];
  }
  const index = visitIds.indexOf(currentId);
  if (index < 0) {
    return delta > 0 ? visitIds[0] : visitIds[visitIds.length - 1];
  }
  const next = Math.min(visitIds.length - 1, Math.max(0, index + delta));
  return visitIds[next];
}
