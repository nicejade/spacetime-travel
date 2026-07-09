<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { CalendarDays, Globe, MapPinned, Plus, RefreshCw, Route, Star } from '@lucide/svelte';
  import MovieOverlay from './components/MovieOverlay.svelte';
  import TimelineStrip from './components/TimelineStrip.svelte';
  import TravelCanvas from './components/TravelCanvas.svelte';
  import TripPanel from './components/TripPanel.svelte';
  import VisitForm from './components/VisitForm.svelte';
  import { deleteVisit, fetchAtlas } from '$lib/api';
  import { formatMonth } from '$lib/format';
  import {
    MovieEngine,
    buildExportFilename,
    canExportVideo,
    computeExportSize,
    downloadBlob,
    recordMovieVideo
  } from '$lib/movie/engine';
  import { plotVisits } from '$lib/movie/plotVisits';
  import type { MovieFrameState } from '$lib/movie/types';
  import type { Atlas, AtlasStats, Visit, VisitMutationResult } from '$lib/types';
  import { visitYear } from '$lib/years';

  let atlas: Atlas | null = null;
  let loading = true;
  let error = '';
  let notice = '';
  let selectedYear: number | 'all' = 'all';
  let selectedVisitId: number | null = null;
  let editorOpen = false;
  let editorMode: 'create' | 'edit' = 'create';
  let editingVisit: Visit | null = null;
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  let movieActive = false;
  let moviePaused = false;
  let movieComplete = false;
  let movieEngine: MovieEngine | null = null;
  let movieFrame: MovieFrameState | null = null;
  let movieSvg: SVGSVGElement | null = null;
  let movieRaf = 0;
  let lastMovieTick = 0;
  let movieExporting = false;
  let movieExportProgress = 0;
  let exportAbort: AbortController | null = null;

  onMount(() => {
    loadAtlas();
    const handleKeydown = (event: KeyboardEvent) => {
      if (!movieActive || movieExporting) return;
      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        toggleMoviePause();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        stopMovie();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      clearTimeout(noticeTimer);
      cancelAnimationFrame(movieRaf);
      window.removeEventListener('keydown', handleKeydown);
      exportAbort?.abort();
    };
  });

  $: visits = atlas?.visits ?? [];
  $: legs = atlas?.legs ?? [];
  $: years = atlas?.years ?? [];
  $: yearColors = atlas?.yearColors ?? {};
  $: stats = (atlas?.stats ?? {
    visitCount: 0,
    countryCount: 0,
    averageRating: 0,
    startYear: null,
    endYear: null
  }) as AtlasStats;
  $: visibleVisits =
    selectedYear === 'all'
      ? visits
      : visits.filter((visit) => visitYear(visit.arrivedAt) === selectedYear);
  $: visibleVisitIds = new Set(visibleVisits.map((visit) => visit.id));
  $: visibleLegs =
    selectedYear === 'all'
      ? legs
      : legs.filter((leg) => visibleVisitIds.has(leg.fromVisitId) && visibleVisitIds.has(leg.toVisitId));
  $: selectedVisit =
    visits.find((visit) => visit.id === selectedVisitId) ?? visibleVisits.at(-1) ?? null;
  $: selectedVisitYear = selectedVisit ? visitYear(selectedVisit.arrivedAt) : null;
  $: selectedYearColor =
    selectedVisitYear !== null ? yearColors[String(selectedVisitYear)] || '#2d7c89' : '#2d7c89';
  $: dateSpan = stats.startYear
    ? stats.startYear === stats.endYear
      ? `${stats.startYear}`
      : `${stats.startYear} - ${stats.endYear}`
    : '未开始';
  $: plottedVisits = plotVisits(visibleVisits, yearColors);
  $: movieActiveLeg =
    movieFrame?.activeLegIndex != null && movieEngine
      ? (() => {
          const resolved = movieEngine.resolvedLegs[movieFrame.activeLegIndex ?? -1];
          if (!resolved) return null;
          const from = movieEngine.visits[resolved.fromIndex];
          const to = movieEngine.visits[resolved.toIndex];
          if (!from || !to) return null;
          return { fromVisitId: from.id, toVisitId: to.id };
        })()
      : null;
  $: movieCanExport = canExportVideo();

  async function loadAtlas() {
    loading = true;
    error = '';

    try {
      atlas = await fetchAtlas();
      const newestVisit = [...atlas.visits].sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt)).at(-1);
      selectedVisitId = selectedVisitId ?? newestVisit?.id ?? null;
    } catch (fetchError) {
      error = fetchError instanceof Error ? fetchError.message : '请求失败';
    } finally {
      loading = false;
    }
  }

  function selectYear(year: number | 'all') {
    selectedYear = year;
    const pool =
      year === 'all' ? visits : visits.filter((visit) => visitYear(visit.arrivedAt) === year);
    selectedVisitId = pool.at(-1)?.id ?? null;
  }

  function selectVisit(id: number) {
    selectedVisitId = id;
  }

  function openCreate() {
    editorMode = 'create';
    editingVisit = null;
    editorOpen = true;
  }

  function openEdit(visit: Visit) {
    editorMode = 'edit';
    editingVisit = visit;
    editorOpen = true;
  }

  function closeEditor() {
    editorOpen = false;
  }

  function flash(message: string) {
    notice = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      notice = '';
    }, 2600);
  }

  function handleSaved(result: VisitMutationResult) {
    atlas = result.atlas;
    selectedVisitId = result.visitId;
    selectedYear = 'all';
    editorOpen = false;
    flash('旅行节点已保存');
  }

  function startMovie(viewport: { width: number; height: number }) {
    if (visibleVisits.length === 0) return;
    movieEngine = new MovieEngine({
      visits: plottedVisits,
      legs: visibleLegs,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height
    });
    movieActive = true;
    moviePaused = false;
    movieComplete = false;
    movieFrame = movieEngine.setElapsedMs(0);
    lastMovieTick = performance.now();
    movieRaf = requestAnimationFrame(runMovieLoop);
  }

  function runMovieLoop(now = performance.now()) {
    if (!movieActive || !movieEngine || moviePaused || movieExporting) return;

    const delta = now - lastMovieTick;
    lastMovieTick = now;
    movieFrame = movieEngine.setElapsedMs(movieEngine.getElapsedMs() + delta);

    if (movieEngine.isComplete()) {
      moviePaused = true;
      movieComplete = true;
      return;
    }

    movieRaf = requestAnimationFrame(runMovieLoop);
  }

  function toggleMoviePause() {
    if (!movieActive || movieExporting) return;
    moviePaused = !moviePaused;
    if (!moviePaused) {
      lastMovieTick = performance.now();
      movieRaf = requestAnimationFrame(runMovieLoop);
    } else {
      cancelAnimationFrame(movieRaf);
    }
  }

  function seekMovie(progress: number) {
    if (!movieEngine) return;
    movieFrame = movieEngine.setElapsedMs(progress * movieEngine.totalDuration);
    movieComplete = movieEngine.isComplete();
    moviePaused = movieComplete;
    if (!moviePaused && movieActive) {
      lastMovieTick = performance.now();
      cancelAnimationFrame(movieRaf);
      movieRaf = requestAnimationFrame(runMovieLoop);
    }
  }

  function stopMovie() {
    if (movieExporting) {
      exportAbort?.abort();
      return;
    }
    movieActive = false;
    moviePaused = false;
    movieComplete = false;
    movieFrame = null;
    movieEngine = null;
    cancelAnimationFrame(movieRaf);
  }

  async function exportMovie() {
    if (!movieEngine || !movieSvg || movieExporting || !movieCanExport) return;

    movieExporting = true;
    movieExportProgress = 0;
    moviePaused = true;
    cancelAnimationFrame(movieRaf);
    exportAbort = new AbortController();

    const { width, height } = computeExportSize(movieSvg.clientWidth, movieSvg.clientHeight);

    try {
      const blob = await recordMovieVideo({
        svg: movieSvg,
        totalDuration: movieEngine.totalDuration,
        width,
        height,
        signal: exportAbort.signal,
        onFrame: async (elapsedMs) => {
          movieFrame = movieEngine!.setElapsedMs(elapsedMs);
          await tick();
          const visit = plottedVisits[movieFrame.activeVisitIndex];
          if (!visit || movieFrame.phase !== 'dwell') return { caption: null };
          return {
            caption: {
              title: `${visit.location.name} · ${formatMonth(visit.arrivedAt)}`,
              body: visit.feeling || '未记录感受',
              opacity: movieFrame.dwellCaptionOpacity
            }
          };
        },
        onProgress: (progress) => {
          movieExportProgress = progress;
        }
      });
      downloadBlob(blob, buildExportFilename(plottedVisits, selectedYear));
      flash('视频已导出');
    } catch (exportError) {
      if (exportError instanceof DOMException && exportError.name === 'AbortError') {
        flash('已取消导出');
      } else {
        flash(exportError instanceof Error ? exportError.message : '导出失败，请重试');
      }
    } finally {
      movieExporting = false;
      movieExportProgress = 0;
      exportAbort = null;
      moviePaused = movieEngine.isComplete();
      if (movieActive && !moviePaused) {
        lastMovieTick = performance.now();
        movieRaf = requestAnimationFrame(runMovieLoop);
      }
    }
  }

  async function handleDelete(visit: Visit) {
    if (!visit) return;
    const confirmed = confirm(`删除 ${visit.location.name} 这条旅行记录？`);
    if (!confirmed) return;

    try {
      const result = await deleteVisit(visit.id);
      atlas = result.atlas;
      selectedVisitId = atlas.visits.at(-1)?.id ?? null;
      flash('旅行节点已删除');
    } catch (deleteError) {
      flash(deleteError instanceof Error ? deleteError.message : '删除失败');
    }
  }
</script>

<main class="app-shell">
  <TravelCanvas
    visits={visibleVisits}
    legs={visibleLegs}
    yearColors={yearColors}
    selectedVisitId={selectedVisit?.id ?? null}
    movieMode={movieActive}
    movieFrame={movieFrame}
    movieActiveLeg={movieActiveLeg}
    onSelectVisit={selectVisit}
    onCreate={openCreate}
    onStartMovie={startMovie}
    on:svgready={(event) => {
      movieSvg = event.detail;
    }}
  />

  {#if movieActive}
    <MovieOverlay
      movieFrame={movieFrame}
      visits={plottedVisits}
      paused={moviePaused}
      complete={movieComplete}
      exporting={movieExporting}
      exportProgress={movieExportProgress}
      canExport={movieCanExport}
      onTogglePause={toggleMoviePause}
      onExit={stopMovie}
      onSeek={seekMovie}
      onExport={exportMovie}
    />
  {/if}

  {#if !movieActive}
  <aside class="atlas-sidebar glass-panel" aria-label="旅行图谱">
    <div class="brand-row">
      <div class="brand-mark">
        <Globe size={22} strokeWidth={1.8} />
      </div>
      <div>
        <p class="eyebrow">spacetime</p>
        <h1>spacetime-travel</h1>
      </div>
    </div>

    <div class="stats-grid" aria-label="旅行统计">
      <div>
        <Route size={17} />
        <span>{stats.visitCount ?? 0}</span>
        <small>节点</small>
      </div>
      <div>
        <MapPinned size={17} />
        <span>{stats.countryCount ?? 0}</span>
        <small>地区</small>
      </div>
      <div>
        <Star size={17} />
        <span>{stats.averageRating ?? 0}</span>
        <small>均分</small>
      </div>
      <div>
        <CalendarDays size={17} />
        <span>{dateSpan}</span>
        <small>时间</small>
      </div>
    </div>

    <div class="trip-filter" aria-label="年份筛选">
      <button type="button" class:active={selectedYear === 'all'} on:click={() => selectYear('all')}>
        所有年份
      </button>
      {#each years as year (year)}
        <button
          type="button"
          style={`--trip-color: ${yearColors[String(year)] || '#2d7c89'}`}
          class:active={selectedYear === year}
          on:click={() => selectYear(year)}
        >
          <span></span>{year}
        </button>
      {/each}
    </div>

    <div class="sidebar-actions">
      <button type="button" class="primary-button" on:click={openCreate}>
        <Plus size={17} />新增节点
      </button>
      <button type="button" class="icon-button" aria-label="刷新旅行数据" title="刷新" on:click={loadAtlas}>
        <RefreshCw size={17} />
      </button>
    </div>

    {#if loading}
      <p class="state-text">正在载入旅行图谱...</p>
    {:else if error}
      <p class="state-text error">{error}</p>
    {:else if notice}
      <p class="state-text">{notice}</p>
    {/if}
  </aside>

  <TripPanel
    visit={selectedVisit}
    year={selectedVisitYear}
    yearColor={selectedYearColor}
    visits={visits}
    stats={stats}
    onEdit={openEdit}
    onDelete={handleDelete}
  />

  <TimelineStrip
    visits={visibleVisits}
    yearColors={yearColors}
    selectedVisitId={selectedVisit?.id ?? null}
    onSelectVisit={selectVisit}
  />
  {/if}

  {#if editorOpen}
    <VisitForm mode={editorMode} visit={editingVisit} onClose={closeEditor} onSaved={handleSaved} />
  {/if}
</main>

<style>
  .app-shell {
    position: relative;
    min-height: 100dvh;
    overflow: hidden;
  }

  .atlas-sidebar {
    position: fixed;
    z-index: 20;
    top: 20px;
    bottom: 126px;
    left: 20px;
    width: min(318px, calc(100vw - 40px));
    display: flex;
    flex-direction: column;
    gap: 18px;
    border-radius: 8px;
    padding: 18px;
  }

  .brand-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .brand-mark {
    display: grid;
    width: 46px;
    height: 46px;
    place-items: center;
    border: 1px solid rgba(35, 95, 115, 0.16);
    border-radius: 8px;
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(234, 247, 245, 0.76));
    color: #225f73;
  }

  .eyebrow {
    margin: 0 0 2px;
    color: #697c82;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    color: #172832;
    font-size: 21px;
    line-height: 1.15;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .stats-grid div {
    min-height: 72px;
    border: 1px solid rgba(31, 54, 63, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.58);
    padding: 10px;
  }

  .stats-grid :global(svg) {
    color: #2d7c89;
  }

  .stats-grid span {
    display: block;
    margin-top: 5px;
    color: #192d37;
    font-size: 19px;
    font-weight: 800;
    line-height: 1;
  }

  .stats-grid small {
    display: block;
    margin-top: 5px;
    color: #687b82;
    font-size: 12px;
  }

  .trip-filter {
    display: flex;
    min-height: 0;
    flex-direction: column;
    gap: 8px;
    overflow: auto;
    padding-right: 2px;
  }

  .trip-filter button {
    display: flex;
    min-height: 44px;
    align-items: center;
    gap: 9px;
    border: 1px solid rgba(31, 54, 63, 0.11);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.58);
    color: #263c45;
    cursor: pointer;
    padding: 0 12px;
    text-align: left;
    transition:
      border-color 160ms ease,
      background 160ms ease,
      transform 160ms ease;
  }

  .trip-filter button:hover,
  .trip-filter button.active {
    border-color: rgba(35, 95, 115, 0.34);
    background: rgba(255, 255, 255, 0.92);
    transform: translateY(-1px);
  }

  .trip-filter span {
    width: 10px;
    height: 10px;
    flex: 0 0 auto;
    border-radius: 999px;
    background: var(--trip-color, #2d7c89);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--trip-color, #2d7c89) 18%, transparent);
  }

  .sidebar-actions {
    display: flex;
    gap: 8px;
    margin-top: auto;
  }

  .sidebar-actions .primary-button {
    flex: 1;
  }

  .state-text {
    margin: -5px 0 0;
    color: #4c646c;
    font-size: 13px;
    line-height: 1.5;
  }

  .state-text.error {
    color: #9b352e;
  }

  @media (max-width: 980px) {
    .atlas-sidebar {
      top: 12px;
      right: 12px;
      bottom: auto;
      left: 12px;
      width: auto;
      max-height: 34dvh;
      overflow: auto;
      padding: 14px;
    }

    .brand-row {
      align-items: flex-start;
    }

    h1 {
      font-size: 19px;
    }

    .stats-grid {
      grid-template-columns: repeat(4, minmax(106px, 1fr));
      overflow-x: auto;
      padding-bottom: 2px;
    }

    .trip-filter {
      flex-direction: row;
      overflow-x: auto;
      overflow-y: hidden;
      padding-bottom: 2px;
    }

    .trip-filter button {
      flex: 0 0 auto;
      white-space: nowrap;
    }
  }
</style>
