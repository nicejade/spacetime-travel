<script lang="ts">
  import { Download, Pause, Play, Square } from '@lucide/svelte';
  import { formatMonth } from '$lib/format';
  import type { MovieFrameState, PlottedVisit } from '$lib/movie/types';

  export let movieFrame: MovieFrameState | null = null;
  export let visits: PlottedVisit[] = [];
  export let paused = false;
  export let complete = false;
  export let exporting = false;
  export let exportProgress = 0;
  export let canExport = true;
  export let onTogglePause: () => void = () => {};
  export let onExit: () => void = () => {};
  export let onSeek: (progress: number) => void = () => {};
  export let onExport: () => void = () => {};

  let controlsVisible = true;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  $: activeVisit = movieFrame ? visits[movieFrame.activeVisitIndex] ?? null : null;
  $: showCaption = movieFrame?.phase === 'dwell' && activeVisit;
  $: captionOpacity = movieFrame?.dwellCaptionOpacity ?? 0;
  $: progressPercent = Math.round((movieFrame?.globalProgress ?? 0) * 100);

  function revealControls() {
    controlsVisible = true;
    clearTimeout(hideTimer);
    if (!exporting) {
      hideTimer = setTimeout(() => {
        controlsVisible = false;
      }, 3000);
    }
  }

  function handleSeek(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    onSeek(Number(target.value) / 100);
  }
</script>

<div
  class="movie-overlay"
  class:controls-visible={controlsVisible || exporting || paused || complete}
  on:pointermove={revealControls}
  role="presentation"
>
  {#if showCaption && activeVisit}
    <div class="movie-caption glass-panel" style={`opacity: ${captionOpacity}`}>
      <p class="caption-title">{activeVisit.location.name} · {formatMonth(activeVisit.arrivedAt)}</p>
      <p class:placeholder={!activeVisit.feeling} class="caption-body">
        {activeVisit.feeling || '未记录感受'}
      </p>
    </div>
  {/if}

  {#if exporting}
    <div class="export-status glass-panel" role="status" aria-live="polite">
      <p>正在生成视频 {Math.round(exportProgress * 100)}%</p>
      {#if exportProgress > 0.5}
        <small>可能需要一分钟</small>
      {/if}
    </div>
  {/if}

  <div class="movie-controls glass-panel" role="group" aria-label="电影模式控制">
    <button type="button" class="icon-button" aria-label={paused ? '继续播放' : '暂停播放'} on:click={onTogglePause} disabled={exporting}>
      {#if paused}
        <Play size={18} />
      {:else}
        <Pause size={18} />
      {/if}
    </button>

    <label class="progress-wrap">
      <span class="sr-only">播放进度</span>
      <input
        type="range"
        min="0"
        max="100"
        value={progressPercent}
        disabled={exporting}
        on:input={handleSeek}
      />
    </label>

    {#if canExport}
      <button
        type="button"
        class="icon-button"
        aria-label="导出视频"
        title="导出 WebM"
        on:click={onExport}
        disabled={exporting}
      >
        <Download size={18} />
      </button>
    {/if}

    <button type="button" class="icon-button" aria-label="退出电影模式" on:click={onExit} disabled={exporting}>
      <Square size={18} />
    </button>
  </div>
</div>

<style>
  .movie-overlay {
    position: fixed;
    inset: 0;
    z-index: 30;
    pointer-events: none;
  }

  .movie-overlay.controls-visible {
    pointer-events: auto;
  }

  .movie-caption {
    position: absolute;
    right: 0;
    bottom: 108px;
    left: 0;
    width: min(480px, calc(100vw - 40px));
    margin: 0 auto;
    border-radius: 8px;
    padding: 18px 20px;
    transition: opacity 180ms ease;
  }

  .caption-title {
    margin: 0 0 10px;
    color: #1e343e;
    font-size: 15px;
    font-weight: 600;
  }

  .caption-body {
    margin: 0;
    color: #2d4650;
    font-size: 20px;
    font-style: italic;
    line-height: 1.55;
  }

  .caption-body.placeholder {
    color: #7b8f96;
    font-style: normal;
    font-size: 15px;
  }

  .export-status {
    position: absolute;
    top: 24px;
    left: 50%;
    border-radius: 999px;
    padding: 12px 18px;
    transform: translateX(-50%);
  }

  .export-status p,
  .export-status small {
    margin: 0;
    text-align: center;
  }

  .export-status small {
    display: block;
    margin-top: 4px;
    color: #687b82;
    font-size: 12px;
  }

  .movie-controls {
    position: absolute;
    right: 20px;
    bottom: 24px;
    left: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: 999px;
    padding: 10px 12px;
    opacity: 0;
    transform: translateY(8px);
    transition:
      opacity 180ms ease,
      transform 180ms ease;
  }

  .movie-overlay.controls-visible .movie-controls,
  .movie-overlay.controls-visible .export-status {
    opacity: 1;
    transform: translateY(0);
  }

  .progress-wrap {
    flex: 1;
    min-width: 0;
  }

  .progress-wrap input[type='range'] {
    width: 100%;
    accent-color: #235f73;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @media (max-width: 980px) {
    .movie-caption {
      bottom: 118px;
    }
  }
</style>
