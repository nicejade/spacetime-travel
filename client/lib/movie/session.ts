import { tick } from 'svelte';
import { get, writable } from 'svelte/store';
import { formatMonth } from '$lib/format';
import type { Leg } from '$lib/types';
import {
  MovieEngine,
  buildExportFilename,
  canExportVideo,
  computeExportSize,
  downloadBlob,
  recordMovieVideo
} from './engine';
import type { MovieFrameState, PlottedVisit } from './types';

export type MovieSessionState = {
  active: boolean;
  paused: boolean;
  complete: boolean;
  frame: MovieFrameState | null;
  exporting: boolean;
  exportProgress: number;
  engine: MovieEngine | null;
  svg: SVGSVGElement | null;
  activeLeg: { fromVisitId: number; toVisitId: number } | null;
};

export type MovieSessionDeps = {
  getVisits: () => PlottedVisit[];
  getLegs: () => Leg[];
  getSelectedYear: () => number | 'all';
  onNotice: (message: string) => void;
};

function resolveActiveLeg(
  engine: MovieEngine | null,
  frame: MovieFrameState | null
): { fromVisitId: number; toVisitId: number } | null {
  if (frame?.activeLegIndex == null || !engine) return null;
  const resolved = engine.resolvedLegs[frame.activeLegIndex];
  if (!resolved) return null;
  const from = engine.visits[resolved.fromIndex];
  const to = engine.visits[resolved.toIndex];
  if (!from || !to) return null;
  return { fromVisitId: from.id, toVisitId: to.id };
}

const idleState = (): MovieSessionState => ({
  active: false,
  paused: false,
  complete: false,
  frame: null,
  exporting: false,
  exportProgress: 0,
  engine: null,
  svg: null,
  activeLeg: null
});

export function createMovieSession(deps: MovieSessionDeps) {
  const { subscribe, set, update } = writable<MovieSessionState>(idleState());

  let raf = 0;
  let lastTick = 0;
  let exportAbort: AbortController | null = null;

  function patch(partial: Partial<MovieSessionState>) {
    update((state) => {
      const next = { ...state, ...partial };
      if ('frame' in partial || 'engine' in partial) {
        next.activeLeg = resolveActiveLeg(next.engine, next.frame);
      }
      return next;
    });
  }

  function read() {
    return get({ subscribe });
  }

  function runLoop(now = performance.now()) {
    const state = read();
    if (!state.active || !state.engine || state.paused || state.exporting) return;

    const delta = now - lastTick;
    lastTick = now;
    const frame = state.engine.setElapsedMs(state.engine.getElapsedMs() + delta);

    if (state.engine.isComplete()) {
      patch({ frame, paused: true, complete: true });
      return;
    }

    patch({ frame });
    raf = requestAnimationFrame(runLoop);
  }

  function startLoop() {
    lastTick = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(runLoop);
  }

  function start(viewport: { width: number; height: number }) {
    const visits = deps.getVisits();
    if (visits.length === 0) return;

    cancelAnimationFrame(raf);
    const engine = new MovieEngine({
      visits,
      legs: deps.getLegs(),
      viewportWidth: viewport.width,
      viewportHeight: viewport.height
    });

    const frame = engine.setElapsedMs(0);
    set({
      active: true,
      paused: false,
      complete: false,
      frame,
      exporting: false,
      exportProgress: 0,
      engine,
      svg: read().svg,
      activeLeg: resolveActiveLeg(engine, frame)
    });
    startLoop();
  }

  function setViewport(viewport: { width: number; height: number }) {
    const state = read();
    if (!state.active || !state.engine) return;
    state.engine.setViewport(viewport.width, viewport.height);
    patch({ frame: state.engine.setElapsedMs(state.engine.getElapsedMs()) });
  }

  function togglePause() {
    const state = read();
    if (!state.active || state.exporting) return;
    const paused = !state.paused;
    patch({ paused });
    if (!paused) startLoop();
    else cancelAnimationFrame(raf);
  }

  function seek(progress: number) {
    const state = read();
    if (!state.engine) return;
    const frame = state.engine.setElapsedMs(progress * state.engine.totalDuration);
    const complete = state.engine.isComplete();
    patch({ frame, complete, paused: complete });
    if (!complete && state.active) startLoop();
  }

  function stop() {
    const state = read();
    if (state.exporting) {
      exportAbort?.abort();
      return;
    }
    cancelAnimationFrame(raf);
    set({ ...idleState(), svg: state.svg });
  }

  async function exportVideo() {
    const state = read();
    if (!state.engine || !state.svg || state.exporting || !canExportVideo()) return;

    cancelAnimationFrame(raf);
    exportAbort = new AbortController();
    patch({ exporting: true, exportProgress: 0, paused: true });

    const { width, height } = computeExportSize(state.svg.clientWidth, state.svg.clientHeight);
    const visits = deps.getVisits();
    const engine = state.engine;

    try {
      const blob = await recordMovieVideo({
        svg: state.svg,
        totalDuration: engine.totalDuration,
        width,
        height,
        signal: exportAbort.signal,
        onFrame: async (elapsedMs) => {
          const frame = engine.setElapsedMs(elapsedMs);
          patch({ frame });
          await tick();
          const visit = visits[frame.activeVisitIndex];
          if (!visit || frame.phase !== 'dwell') return { caption: null };
          return {
            caption: {
              title: `${visit.location.name} · ${formatMonth(visit.arrivedAt)}`,
              body: visit.feeling || '未记录感受',
              opacity: frame.dwellCaptionOpacity
            }
          };
        },
        onProgress: (progress) => {
          patch({ exportProgress: progress });
        }
      });
      downloadBlob(blob, buildExportFilename(visits, deps.getSelectedYear()));
      deps.onNotice('视频已导出');
    } catch (exportError) {
      if (exportError instanceof DOMException && exportError.name === 'AbortError') {
        deps.onNotice('已取消导出');
      } else {
        deps.onNotice(exportError instanceof Error ? exportError.message : '导出失败，请重试');
      }
    } finally {
      exportAbort = null;
      const current = read();
      const paused = current.engine?.isComplete() ?? true;
      patch({ exporting: false, exportProgress: 0, paused });
      if (current.active && !paused) startLoop();
    }
  }

  function setSvg(svg: SVGSVGElement | null) {
    patch({ svg });
  }

  function dispose() {
    cancelAnimationFrame(raf);
    exportAbort?.abort();
    exportAbort = null;
    set(idleState());
  }

  return {
    subscribe,
    start,
    setViewport,
    togglePause,
    seek,
    stop,
    exportVideo,
    setSvg,
    dispose,
    canExport: canExportVideo
  };
}

export type MovieSession = ReturnType<typeof createMovieSession>;
