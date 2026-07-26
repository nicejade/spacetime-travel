<script lang="ts">
  import { onMount } from 'svelte';
  import {
    BarChart3,
    CalendarDays,
    Download,
    Globe,
    Image,
    MapPinned,
    MoreHorizontal,
    Plus,
    RefreshCw,
    Route,
    Star,
    Upload
  } from '@lucide/svelte';
  import MovieOverlay from './components/MovieOverlay.svelte';
  import PosterPreview from './components/PosterPreview.svelte';
  import TimelineStrip from './components/TimelineStrip.svelte';
  import TravelCanvas from './components/TravelCanvas.svelte';
  import StatsView from './components/StatsView.svelte';
  import TripPanel from './components/TripPanel.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import VisitForm from './components/VisitForm.svelte';
  import {
    createVisit,
    deleteVisit,
    fetchAtlas,
    fetchExportDocument,
    importAtlasDocument,
    isAbortError
  } from '$lib/api';
  import { confirm, confirmStore } from '$lib/confirm';
  import { downloadBlob } from '$lib/movie/engine';
  import { createMovieSession } from '$lib/movie/session';
  import { plotVisits } from '$lib/movie/plotVisits';
  import { createPosterPreview } from '$lib/poster/preview';
  import { adjacentVisitId, isTypingTarget, resolveShortcut } from '$lib/shortcuts';
  import type { Atlas, AtlasStats, Visit, VisitMutationResult, VisitPayload } from '$lib/types';
  import { visitToPayload } from '$lib/visitPayload';
  import { yearAfterSave } from '$lib/yearFilter';
  import { visitYear } from '$lib/years';
  import type { LonLatPick } from '$lib/map/pickLonLat';
  import { get } from 'svelte/store';

  let atlas: Atlas | null = null;
  let loading = true;
  let error = '';
  let notice = '';
  let selectedYear: number | 'all' = 'all';
  let selectedVisitId: number | null = null;
  let editorOpen = false;
  let editorMode: 'create' | 'edit' = 'create';
  let editingVisit: Visit | null = null;
  let createPrefill: LonLatPick | null = null;
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  let activeView: 'map' | 'stats' = 'map';
  let statsYear: number | 'all' = 'all';
  let importInput: HTMLInputElement | null = null;
  let backupBusy = false;
  let undoPayload: VisitPayload | null = null;
  let undoBusy = false;
  let atlasController: AbortController | null = null;
  let toolsMenuOpen = false;
  let toolsMenuRoot: HTMLElement | null = null;
  let travelCanvas: {
    zoomIn: () => void;
    zoomOut: () => void;
    resetView: () => void;
  } | undefined;

  const UNDO_WINDOW_MS = 8000;

  const movie = createMovieSession({
    getVisits: () => plottedVisits,
    getLegs: () => visibleLegs,
    getSelectedYear: () => selectedYear,
    onNotice: (message) => flash(message)
  });
  const poster = createPosterPreview();

  onMount(() => {
    loadAtlas();
    const handleKeydown = (event: KeyboardEvent) => {
      if (toolsMenuOpen && event.key === 'Escape') {
        event.preventDefault();
        closeToolsMenu();
        return;
      }

      const movieState = get(movie);
      const action = resolveShortcut(event, {
        movieActive: movieState.active,
        movieExporting: movieState.exporting,
        modalOpen: editorOpen || get(confirmStore).open || get(poster).open,
        typing: isTypingTarget(event.target),
        mapInteractive: activeView === 'map'
      });
      if (!action) return;

      event.preventDefault();
      switch (action.type) {
        case 'movie-toggle-pause':
          movie.togglePause();
          break;
        case 'movie-stop':
          movie.stop();
          break;
        case 'zoom-in':
          travelCanvas?.zoomIn();
          break;
        case 'zoom-out':
          travelCanvas?.zoomOut();
          break;
        case 'zoom-reset':
          travelCanvas?.resetView();
          break;
        case 'prev-visit': {
          const nextId = adjacentVisitId(
            visibleVisits.map((visit) => visit.id),
            selectedVisitId,
            -1
          );
          if (nextId != null) selectVisit(nextId);
          break;
        }
        case 'next-visit': {
          const nextId = adjacentVisitId(
            visibleVisits.map((visit) => visit.id),
            selectedVisitId,
            1
          );
          if (nextId != null) selectVisit(nextId);
          break;
        }
        case 'create-visit':
          openCreate();
          break;
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!toolsMenuOpen || !toolsMenuRoot) return;
      if (!toolsMenuRoot.contains(event.target as Node)) {
        closeToolsMenu();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      clearTimeout(noticeTimer);
      window.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('pointerdown', handlePointerDown);
      movie.dispose();
    };
  });

  $: visits = atlas?.visits ?? [];
  $: legs = atlas?.legs ?? [];
  $: visitRoutes = atlas?.visitRoutes ?? [];
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
  $: visibleVisitRoutes =
    selectedYear === 'all'
      ? visitRoutes
      : visitRoutes.filter((route) => visibleVisitIds.has(route.visitId));
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
  $: posterDisabledReason = poster.posterDisabledReason(
    selectedYear,
    visibleVisits.length,
    $poster.generating
  );
  $: canGeneratePoster = posterDisabledReason === '';

  async function loadAtlas() {
    atlasController?.abort();
    const controller = new AbortController();
    atlasController = controller;
    loading = true;
    error = '';

    try {
      const next = await fetchAtlas({ signal: controller.signal });
      if (atlasController !== controller) return;
      atlas = next;
      const newestVisit = [...atlas.visits].sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt)).at(-1);
      selectedVisitId = selectedVisitId ?? newestVisit?.id ?? null;
    } catch (fetchError) {
      if (isAbortError(fetchError) || controller.signal.aborted) return;
      error = fetchError instanceof Error ? fetchError.message : '请求失败';
    } finally {
      if (atlasController === controller) {
        loading = false;
        atlasController = null;
      }
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

  function openCreate(prefill: LonLatPick | null = null) {
    editorMode = 'create';
    editingVisit = null;
    createPrefill = prefill;
    editorOpen = true;
  }

  function openEdit(visit: Visit) {
    editorMode = 'edit';
    editingVisit = visit;
    createPrefill = null;
    editorOpen = true;
  }

  function closeEditor() {
    editorOpen = false;
    createPrefill = null;
  }

  function flash(message: string, options?: { undo?: VisitPayload }) {
    notice = message;
    undoPayload = options?.undo ?? null;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(
      () => {
        notice = '';
        undoPayload = null;
      },
      options?.undo ? UNDO_WINDOW_MS : 2600
    );
  }

  function handleSaved(result: VisitMutationResult) {
    atlas = result.atlas;
    selectedVisitId = result.visitId;
    const saved = result.atlas.visits.find((visit) => visit.id === result.visitId);
    if (saved) {
      selectedYear = yearAfterSave(selectedYear, saved.arrivedAt);
    }
    editorOpen = false;
    createPrefill = null;
    flash('旅行节点已保存');
  }

  async function openPosterPreview() {
    if (!canGeneratePoster || typeof selectedYear !== 'number') return;
    await poster.open({
      year: selectedYear,
      yearColor: yearColors[String(selectedYear)] || '#2d7c89',
      visits: visibleVisits,
      legs: visibleLegs,
      yearColors
    });
  }

  function openStatsView() {
    if (loading) return;
    activeView = 'stats';
  }

  function closeStatsView() {
    activeView = 'map';
  }

  function toggleToolsMenu() {
    toolsMenuOpen = !toolsMenuOpen;
  }

  function closeToolsMenu() {
    toolsMenuOpen = false;
  }

  function runToolsAction(action: () => void | Promise<void>) {
    closeToolsMenu();
    void action();
  }

  async function handleDelete(visit: Visit) {
    if (!visit) return;
    const confirmed = await confirm({
      message: `删除 ${visit.location.name} 这条旅行记录？`,
      variant: 'danger'
    });
    if (!confirmed) return;

    const restorePayload = visitToPayload(visit);

    try {
      const result = await deleteVisit(visit.id);
      atlas = result.atlas;
      selectedVisitId = atlas.visits.at(-1)?.id ?? null;
      flash(`已删除「${visit.location.name}」`, { undo: restorePayload });
    } catch (deleteError) {
      flash(deleteError instanceof Error ? deleteError.message : '删除失败');
    }
  }

  async function undoDelete() {
    if (!undoPayload || undoBusy) return;
    undoBusy = true;
    try {
      const result = await createVisit(undoPayload);
      atlas = result.atlas;
      selectedVisitId = result.visitId;
      flash('已恢复旅行节点');
    } catch (undoError) {
      flash(undoError instanceof Error ? undoError.message : '撤销失败');
    } finally {
      undoBusy = false;
    }
  }

  async function handleExportData() {
    if (backupBusy) return;
    backupBusy = true;
    try {
      const document = await fetchExportDocument();
      const stamp = document.exportedAt.slice(0, 10);
      const blob = new Blob([JSON.stringify(document, null, 2)], {
        type: 'application/json'
      });
      downloadBlob(blob, `spacetime-travel-${stamp}.json`);
      flash(`已导出 ${document.visits.length} 个节点`);
    } catch (exportError) {
      flash(exportError instanceof Error ? exportError.message : '导出失败');
    } finally {
      backupBusy = false;
    }
  }

  function openImportPicker() {
    if (backupBusy) return;
    importInput?.click();
  }

  async function handleImportFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const confirmed = await confirm({
      title: '导入旅行数据',
      message: `导入「${file.name}」将替换当前全部旅行节点，且不可撤销。建议先导出备份。`,
      confirmLabel: '替换导入',
      cancelLabel: '取消',
      variant: 'danger'
    });
    if (!confirmed) return;

    backupBusy = true;
    try {
      const text = await file.text();
      let document: unknown;
      try {
        document = JSON.parse(text);
      } catch {
        throw new Error('无法解析 JSON 文件');
      }

      const result = await importAtlasDocument(document);
      atlas = result.atlas;
      selectedYear = 'all';
      selectedVisitId = atlas.visits.at(-1)?.id ?? null;
      flash(`已导入 ${result.visitCount} 个节点`);
    } catch (importError) {
      flash(importError instanceof Error ? importError.message : '导入失败');
    } finally {
      backupBusy = false;
    }
  }
</script>

<main class="app-shell">
  <TravelCanvas
    bind:this={travelCanvas}
    visits={visibleVisits}
    plottedVisits={plottedVisits}
    legs={visibleLegs}
    visitRoutes={visibleVisitRoutes}
    selectedVisitId={selectedVisit?.id ?? null}
    movieMode={$movie.active}
    movieFrame={$movie.frame}
    movieActiveLeg={$movie.activeLeg}
    onSelectVisit={selectVisit}
    onCreate={openCreate}
    onCreateAt={(place) => openCreate(place)}
    onStartMovie={movie.start}
    onViewportChange={movie.setViewport}
    on:svgready={(event) => {
      movie.setSvg(event.detail);
    }}
  />

  {#if error && !atlas && !loading}
    <div class="map-error" role="alert">
      <p>{error}</p>
      <button type="button" class="primary-button" on:click={loadAtlas}>重试</button>
    </div>
  {/if}

  {#if $movie.active}
    <MovieOverlay
      movieFrame={$movie.frame}
      visits={plottedVisits}
      paused={$movie.paused}
      complete={$movie.complete}
      exporting={$movie.exporting}
      exportProgress={$movie.exportProgress}
      canExport={movie.canExport()}
      onTogglePause={movie.togglePause}
      onExit={movie.stop}
      onSeek={movie.seek}
      onExport={movie.exportVideo}
    />
  {/if}

  {#if activeView === 'stats'}
    <StatsView
      visits={visits}
      legs={legs}
      years={years}
      yearColors={yearColors}
      statsYear={statsYear}
      loading={loading}
      onBack={closeStatsView}
      onStatsYearChange={(year) => {
        statsYear = year;
      }}
    />
  {/if}

  {#if !$movie.active && activeView === 'map'}
  <aside class="atlas-sidebar glass-panel" aria-label="旅行图谱">
    <div class="brand-row">
      <div class="brand-identity">
        <div class="brand-mark">
          <Globe size={22} strokeWidth={1.8} />
        </div>
        <div>
          <p class="eyebrow">spacetime</p>
          <h1>TRAVEL</h1>
        </div>
      </div>

      <div class="tools-menu" bind:this={toolsMenuRoot}>
        <button
          type="button"
          class="icon-button tools-menu-trigger"
          aria-label="更多操作"
          title="更多操作"
          aria-haspopup="menu"
          aria-expanded={toolsMenuOpen}
          on:click={toggleToolsMenu}
        >
          <MoreHorizontal size={18} />
        </button>

        {#if toolsMenuOpen}
          <div class="tools-menu-panel glass-panel" role="menu" aria-label="更多操作">
            <button
              type="button"
              role="menuitem"
              disabled={loading}
              title="查看旅行统计"
              on:click={() => runToolsAction(openStatsView)}
            >
              <BarChart3 size={17} />旅行统计
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!canGeneratePoster}
              title={posterDisabledReason || '生成该年旅行海报'}
              on:click={() => runToolsAction(openPosterPreview)}
            >
              <Image size={17} />生成海报
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={loading || backupBusy}
              title="导出全部旅行数据为 JSON"
              on:click={() => runToolsAction(handleExportData)}
            >
              <Download size={17} />导出数据
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={loading || backupBusy}
              title="从 JSON 备份替换导入"
              on:click={() => runToolsAction(openImportPicker)}
            >
              <Upload size={17} />导入数据
            </button>
          </div>
        {/if}
      </div>
    </div>

    <input
      bind:this={importInput}
      type="file"
      accept="application/json,.json"
      hidden
      on:change={handleImportFile}
    />

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
      <button type="button" class="primary-button" on:click={() => openCreate()}>
        <Plus size={17} />新增节点
      </button>
      <button type="button" class="icon-button" aria-label="刷新旅行数据" title="刷新" on:click={loadAtlas}>
        <RefreshCw size={17} />
      </button>
    </div>

    {#if loading}
      <p class="state-text">正在载入旅行图谱...</p>
    {/if}
    {#if error}
      <p class="state-text error">{error}</p>
    {/if}
    {#if notice}
      <div class="state-text notice-row" role="status">
        <span>{notice}</span>
        {#if undoPayload}
          <button type="button" class="undo-button" disabled={undoBusy} on:click={undoDelete}>
            撤销
          </button>
        {/if}
      </div>
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
    <VisitForm
      mode={editorMode}
      visit={editingVisit}
      initialPlace={createPrefill}
      originSuggestions={atlas?.originSuggestions ?? []}
      showInboundFields={editorMode === 'edit' && editingVisit ? editingVisit.sequence > 1 : visits.length > 0}
      onClose={closeEditor}
      onSaved={handleSaved}
    />
  {/if}

  <PosterPreview
    open={$poster.open}
    generating={$poster.generating}
    blob={$poster.blob}
    filename={$poster.filename}
    error={$poster.error}
    onClose={poster.close}
  />

  <ConfirmDialog />
</main>

<style>
  .app-shell {
    position: relative;
    min-height: 100dvh;
    overflow: hidden;
  }

  .map-error {
    position: absolute;
    z-index: 15;
    inset: 0;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 14px;
    padding: 24px;
    background: rgba(231, 240, 227, 0.72);
    color: #9b352e;
    font-size: 15px;
    font-weight: 600;
    text-align: center;
  }

  .map-error p {
    margin: 0;
    max-width: 28rem;
    line-height: 1.5;
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
    justify-content: space-between;
    gap: 12px;
  }

  .brand-identity {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 12px;
  }

  .brand-mark {
    display: grid;
    width: 46px;
    height: 46px;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid rgba(35, 95, 115, 0.16);
    border-radius: 8px;
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(234, 247, 245, 0.76));
    color: #225f73;
  }

  .eyebrow {
    margin: 0 0 2px;
    color: #697c82;
    font-size: 17px;
    font-weight: 800;
    letter-spacing: 0.02em;
    line-height: 1.15;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    color: #172832;
    font-size: 17px;
    font-weight: 800;
    letter-spacing: 0.02em;
    line-height: 1.15;
  }

  .tools-menu {
    position: relative;
    flex: 0 0 auto;
  }

  .tools-menu-trigger {
    min-width: 40px;
    min-height: 40px;
  }

  .tools-menu-panel {
    position: absolute;
    z-index: 30;
    top: calc(100% + 8px);
    right: 0;
    display: flex;
    min-width: 168px;
    flex-direction: column;
    gap: 2px;
    border-radius: 12px;
    padding: 6px;
  }

  .tools-menu-panel button {
    display: flex;
    width: 100%;
    min-height: 40px;
    align-items: center;
    gap: 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #1f3640;
    cursor: pointer;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    padding: 0 12px;
    text-align: left;
    transition: background 140ms ease;
  }

  .tools-menu-panel button:hover:not(:disabled) {
    background: rgba(35, 95, 115, 0.1);
  }

  .tools-menu-panel button:focus-visible {
    outline: 3px solid rgba(58, 132, 145, 0.28);
    outline-offset: 1px;
  }

  .tools-menu-panel button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .tools-menu-panel :global(svg) {
    flex: 0 0 auto;
    color: #2d7c89;
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
    padding: 1px 2px 1px 0;
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

  .notice-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .undo-button {
    flex: 0 0 auto;
    border: 0;
    padding: 0;
    background: transparent;
    color: #1f6f82;
    font: inherit;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }

  .undo-button:hover:not(:disabled) {
    color: #155566;
  }

  .undo-button:disabled {
    opacity: 0.55;
    cursor: default;
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
      align-items: center;
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
      padding: 1px 0 2px;
    }

    .trip-filter button {
      flex: 0 0 auto;
      white-space: nowrap;
    }
  }
</style>
