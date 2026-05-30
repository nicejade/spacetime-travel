<script>
  import { onMount } from 'svelte';
  import { CalendarDays, Globe, MapPinned, Plus, RefreshCw, Route, Star } from '@lucide/svelte';
  import TimelineStrip from './components/TimelineStrip.svelte';
  import TravelCanvas from './components/TravelCanvas.svelte';
  import TripPanel from './components/TripPanel.svelte';
  import VisitForm from './components/VisitForm.svelte';
  import { deleteVisit, fetchAtlas } from '$lib/api';

  let atlas = null;
  let loading = true;
  let error = '';
  let notice = '';
  let selectedTripId = 'all';
  let selectedVisitId = null;
  let editorOpen = false;
  let editorMode = 'create';
  let editingVisit = null;
  let noticeTimer;

  onMount(() => {
    loadAtlas();
    return () => clearTimeout(noticeTimer);
  });

  $: trips = atlas?.trips ?? [];
  $: stats = atlas?.stats ?? {};
  $: allVisits = trips
    .flatMap((trip) => trip.visits.map((visit) => ({ ...visit, trip })))
    .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
  $: visibleTrips =
    selectedTripId === 'all'
      ? trips
      : trips.filter((trip) => String(trip.id) === String(selectedTripId));
  $: visibleVisits = visibleTrips
    .flatMap((trip) => trip.visits.map((visit) => ({ ...visit, trip })))
    .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
  $: selectedVisit = allVisits.find((visit) => visit.id === selectedVisitId) ?? visibleVisits.at(-1) ?? null;
  $: selectedTrip = selectedVisit ? trips.find((trip) => trip.id === selectedVisit.tripId) : null;
  $: dateSpan = stats.startYear
    ? stats.startYear === stats.endYear
      ? `${stats.startYear}`
      : `${stats.startYear} - ${stats.endYear}`
    : '未开始';

  async function loadAtlas() {
    loading = true;
    error = '';

    try {
      atlas = await fetchAtlas();
      const newestVisit = atlas.trips
        .flatMap((trip) => trip.visits)
        .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt))
        .at(-1);
      selectedVisitId = selectedVisitId ?? newestVisit?.id ?? null;
    } catch (fetchError) {
      error = fetchError.message;
    } finally {
      loading = false;
    }
  }

  function selectTrip(id) {
    selectedTripId = id;
    const nextVisit =
      id === 'all'
        ? allVisits.at(-1)
        : trips.find((trip) => String(trip.id) === String(id))?.visits.at(-1);
    selectedVisitId = nextVisit?.id ?? null;
  }

  function selectVisit(id) {
    selectedVisitId = id;
  }

  function openCreate() {
    editorMode = 'create';
    editingVisit = null;
    editorOpen = true;
  }

  function openEdit(visit) {
    editorMode = 'edit';
    editingVisit = visit;
    editorOpen = true;
  }

  function closeEditor() {
    editorOpen = false;
  }

  function flash(message) {
    notice = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      notice = '';
    }, 2600);
  }

  function handleSaved(result) {
    atlas = result.atlas;
    selectedVisitId = result.visitId;
    selectedTripId = 'all';
    editorOpen = false;
    flash('旅行节点已保存');
  }

  async function handleDelete(visit) {
    if (!visit) return;
    const confirmed = confirm(`删除 ${visit.location.name} 这条旅行记录？`);
    if (!confirmed) return;

    try {
      const result = await deleteVisit(visit.id);
      atlas = result.atlas;
      const nextVisit = atlas.trips.flatMap((trip) => trip.visits).at(-1);
      selectedVisitId = nextVisit?.id ?? null;
      flash('旅行节点已删除');
    } catch (deleteError) {
      flash(deleteError.message);
    }
  }
</script>

<main class="app-shell">
  <TravelCanvas
    trips={visibleTrips}
    selectedVisitId={selectedVisit?.id ?? null}
    onSelectVisit={selectVisit}
    onCreate={openCreate}
  />

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

    <div class="trip-filter" aria-label="旅行线筛选">
      <button
        type="button"
        class:active={selectedTripId === 'all'}
        on:click={() => selectTrip('all')}
      >
        全部轨迹
      </button>
      {#each trips as trip (trip.id)}
        <button
          type="button"
          style={`--trip-color: ${trip.color}`}
          class:active={String(selectedTripId) === String(trip.id)}
          on:click={() => selectTrip(trip.id)}
        >
          <span></span>{trip.title}
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
    trip={selectedTrip}
    trips={trips}
    stats={stats}
    onEdit={openEdit}
    onDelete={handleDelete}
  />

  <TimelineStrip trips={visibleTrips} selectedVisitId={selectedVisit?.id ?? null} onSelectVisit={selectVisit} />

  {#if editorOpen}
    <VisitForm
      mode={editorMode}
      trips={trips}
      visit={editingVisit}
      trip={editingVisit ? trips.find((item) => item.id === editingVisit.tripId) : null}
      onClose={closeEditor}
      onSaved={handleSaved}
    />
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
