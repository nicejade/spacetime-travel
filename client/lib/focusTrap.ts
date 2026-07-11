const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

export type FocusTrapOptions = {
  onEscape?: () => void;
};

/**
 * Decide whether Tab should be intercepted by the trap.
 * Returns the element to focus, or null to let the browser move focus normally.
 */
export function resolveTabTarget(
  focusables: HTMLElement[],
  activeElement: Element | null,
  shiftKey: boolean
): HTMLElement | null {
  if (focusables.length === 0) return null;

  const index = focusables.indexOf(activeElement as HTMLElement);
  if (index === -1) {
    return shiftKey ? focusables[focusables.length - 1] : focusables[0];
  }

  if (shiftKey && index === 0) return focusables[focusables.length - 1];
  if (!shiftKey && index === focusables.length - 1) return focusables[0];
  return null;
}

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      element.getAttribute('aria-hidden') !== 'true' &&
      !element.hasAttribute('disabled') &&
      element.tabIndex >= 0
  );
}

export function createFocusTrap(container: HTMLElement, options: FocusTrapOptions = {}): () => void {
  const previouslyFocused =
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  const focusInitial = () => {
    const focusables = getFocusableElements(container);
    const target = focusables[0] ?? container;
    target.focus();
  };

  queueMicrotask(focusInitial);

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (!options.onEscape) return;
      event.preventDefault();
      event.stopPropagation();
      options.onEscape();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusables = getFocusableElements(container);
    if (focusables.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }

    const target = resolveTabTarget(focusables, document.activeElement, event.shiftKey);
    if (!target) return;

    event.preventDefault();
    target.focus();
  };

  document.addEventListener('keydown', onKeydown, true);

  return () => {
    document.removeEventListener('keydown', onKeydown, true);
    previouslyFocused?.focus?.();
  };
}

/** Svelte action: `use:focusTrap={{ onEscape }}` */
export function focusTrap(node: HTMLElement, options: FocusTrapOptions = {}) {
  let current = options;
  const release = createFocusTrap(node, {
    onEscape: () => current.onEscape?.()
  });

  return {
    update(next: FocusTrapOptions = {}) {
      current = next;
    },
    destroy() {
      release();
    }
  };
}
