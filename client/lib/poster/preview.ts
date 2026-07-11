import { writable } from 'svelte/store';
import type { Leg, Visit } from '$lib/types';
import { buildPosterFilename, generatePoster } from './renderPoster';

export type PosterPreviewState = {
  open: boolean;
  generating: boolean;
  blob: Blob | null;
  error: string;
  filename: string;
};

const idleState = (): PosterPreviewState => ({
  open: false,
  generating: false,
  blob: null,
  error: '',
  filename: 'spacetime-travel.png'
});

export function posterDisabledReason(
  selectedYear: number | 'all',
  visitCount: number,
  generating: boolean
): string {
  if (selectedYear === 'all') return '请先选择具体年份';
  if (visitCount === 0) return '该年暂无旅行记录';
  if (generating) return '正在生成海报…';
  return '';
}

export function createPosterPreview() {
  const { subscribe, set, update } = writable<PosterPreviewState>(idleState());

  async function open(input: {
    year: number;
    yearColor: string;
    visits: Visit[];
    legs: Leg[];
    yearColors: Record<string, string>;
  }) {
    set({
      open: true,
      generating: true,
      blob: null,
      error: '',
      filename: buildPosterFilename(input.year)
    });

    try {
      const blob = await generatePoster(input);
      update((state) => ({ ...state, blob, generating: false }));
    } catch (error) {
      update((state) => ({
        ...state,
        generating: false,
        error: error instanceof Error ? error.message : '海报生成失败，请重试'
      }));
    }
  }

  function close() {
    update((state) => {
      if (state.generating) return state;
      return idleState();
    });
  }

  return {
    subscribe,
    open,
    close,
    posterDisabledReason
  };
}

export type PosterPreview = ReturnType<typeof createPosterPreview>;
