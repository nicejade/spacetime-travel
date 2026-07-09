import { get, writable } from 'svelte/store';

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
};

type ConfirmState = {
  open: boolean;
  options: ConfirmOptions | null;
  onResolve: ((value: boolean) => void) | null;
};

function createConfirmStore() {
  const { subscribe, set } = writable<ConfirmState>({
    open: false,
    options: null,
    onResolve: null
  });

  function showConfirm(options: ConfirmOptions | string): Promise<boolean> {
    const resolved =
      typeof options === 'string'
        ? { message: options }
        : options;

    return new Promise((resolve) => {
      set({ open: true, options: resolved, onResolve: resolve });
    });
  }

  function settle(value: boolean) {
    const state = get({ subscribe });
    state.onResolve?.(value);
    set({ open: false, options: null, onResolve: null });
  }

  return { subscribe, confirm: showConfirm, settle };
}

export const confirmStore = createConfirmStore();
export const confirm = confirmStore.confirm;
