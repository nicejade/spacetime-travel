<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Pause, Play, Plus, RotateCcw, ZoomIn, ZoomOut } from '@lucide/svelte';
  import { geoGraticule } from 'd3-geo';
  import { formatMonth, transportClass, transportDash } from '$lib/format';
  import { MAP_HEIGHT, MAP_WIDTH, countryFeatures, pathGenerator, projection } from '$lib/geo';
  import type { Trip } from '$lib/types';

  export let trips: Trip[] = [];
  export let selectedVisitId: number | null = null;
  export let onSelectVisit: (id: number) => void = () => {};
  export let onCreate: () => void = () => {};

  const mapWidth = MAP_WIDTH;
  const mapHeight = MAP_HEIGHT;
  const graticule = geoGraticule().step([30, 30]);
  const graticulePath = pathGenerator(graticule());
  const spherePath = pathGenerator({ type: 'Sphere' });

  let shell: HTMLElement;
  let viewportWidth = 1280;
  let viewportHeight = 820;
  let pan = { x: 0, y: 0 };
  let scale = 0.52;
  let hasFit = false;
  let dragging = false;
  let lastPointer = { x: 0, y: 0 };
  let playing = false;
  let playTimer: ReturnType<typeof setInterval> | undefined;
  let playbackIndex = 0;
  let controlStatus = 'Ready';
  let statusTimer: ReturnType<typeof setTimeout> | undefined;

  $: plottedTrips = trips.map((trip) => ({
    ...trip,
    visits: trip.visits.map((visit) => {
      const [x, y] = projection([visit.location.lng, visit.location.lat]) ?? [0, 0];
      return { ...visit, x, y, tripColor: trip.color, tripTitle: trip.title };
    })
  }));
  $: plottedVisits = plottedTrips
    .flatMap((trip) => trip.visits.map((visit) => ({ ...visit, trip })))
    .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
  $: zoomLabel = `${Math.round(scale * 100)}%`;

  onMount(() => {
    const resizeObserver = new ResizeObserver(([entry]) => {
      viewportWidth = entry.contentRect.width;
      viewportHeight = entry.contentRect.height;
      if (!hasFit) {
        fitWorld();
        hasFit = true;
      }
    });

    resizeObserver.observe(shell);
    return () => resizeObserver.disconnect();
  });

  onDestroy(() => {
    stopPlayback();
    clearTimeout(statusTimer);
  });

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function fitWorld() {
    const nextScale = clamp(Math.min((viewportWidth * 0.86) / mapWidth, (viewportHeight * 0.74) / mapHeight), 0.24, 1.1);
    scale = nextScale;
    pan = {
      x: (viewportWidth - mapWidth * nextScale) / 2,
      y: (viewportHeight - mapHeight * nextScale) / 2
    };
    setControlStatus('View reset');
  }

  function zoomAt(factor: number, clientX = viewportWidth / 2, clientY = viewportHeight / 2) {
    const nextScale = clamp(scale * factor, 0.22, 4.6);
    const worldX = (clientX - pan.x) / scale;
    const worldY = (clientY - pan.y) / scale;
    scale = nextScale;
    pan = {
      x: clientX - worldX * nextScale,
      y: clientY - worldY * nextScale
    };
    setControlStatus(`Zoom ${Math.round(nextScale * 100)}%`);
  }

  function handleWheel(event: WheelEvent) {
    event.preventDefault();
    const rect = shell.getBoundingClientRect();
    zoomAt(event.deltaY > 0 ? 0.9 : 1.12, event.clientX - rect.left, event.clientY - rect.top);
  }

  function startPan(event: PointerEvent) {
    if (event.target instanceof Element && event.target.closest('.canvas-controls')) return;
    if (event.button !== 0) return;
    dragging = true;
    lastPointer = { x: event.clientX, y: event.clientY };
    shell.setPointerCapture(event.pointerId);
  }

  function movePan(event) {
    if (!dragging) return;
    pan = {
      x: pan.x + event.clientX - lastPointer.x,
      y: pan.y + event.clientY - lastPointer.y
    };
    lastPointer = { x: event.clientX, y: event.clientY };
  }

  function endPan(event) {
    dragging = false;
    if (shell.hasPointerCapture(event.pointerId)) {
      shell.releasePointerCapture(event.pointerId);
    }
  }

  function getVisitPoint(trip, visitId) {
    return trip.visits.find((visit) => visit.id === visitId);
  }

  function routePath(trip, leg, index) {
    const from = getVisitPoint(trip, leg.fromVisitId);
    const to = getVisitPoint(trip, leg.toVisitId);

    if (!from || !to) return '';

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy) || 1;
    const curve = clamp(distance * 0.16, 34, 150);
    const direction = index % 2 === 0 ? 1 : -1;
    const controlX = (from.x + to.x) / 2 + (-dy / distance) * curve * direction;
    const controlY = (from.y + to.y) / 2 + (dx / distance) * curve * direction;

    return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} Q ${controlX.toFixed(2)} ${controlY.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
  }

  function focusVisit(visit, targetScale = Math.max(scale, 0.86)) {
    scale = clamp(targetScale, 0.42, 2.6);
    pan = {
      x: viewportWidth / 2 - visit.x * scale,
      y: viewportHeight / 2 - visit.y * scale
    };
  }

  function selectNode(visit) {
    onSelectVisit(visit.id);
    focusVisit(visit);
    setControlStatus(`${visit.location.name} focused`);
  }

  function startPlayback() {
    if (playing || plottedVisits.length === 0) return;
    playing = true;
    const selectedIndex = plottedVisits.findIndex((visit) => visit.id === selectedVisitId);
    playbackIndex = selectedIndex >= 0 ? selectedIndex + 1 : 0;
    const firstVisit = plottedVisits[playbackIndex % plottedVisits.length];
    onSelectVisit(firstVisit.id);
    focusVisit(firstVisit, 0.92);
    playbackIndex += 1;
    setControlStatus('Playing route');

    playTimer = setInterval(() => {
      const visit = plottedVisits[playbackIndex % plottedVisits.length];
      onSelectVisit(visit.id);
      focusVisit(visit, 0.92);
      playbackIndex += 1;
    }, 1300);
  }

  function stopPlayback() {
    playing = false;
    clearInterval(playTimer);
    setControlStatus('Playback paused');
  }

  function togglePlayback() {
    if (playing) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }

  function handleCreate() {
    stopPlayback();
    onCreate();
    setControlStatus('New visit');
  }

  function stopControlEvent(event) {
    event.stopPropagation();
  }

  function setControlStatus(message) {
    controlStatus = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      controlStatus = 'Ready';
    }, 1800);
  }
</script>

<section
  bind:this={shell}
  class="canvas-shell"
  aria-label="旅行时空画布"
  on:wheel={handleWheel}
  on:pointerdown={startPan}
  on:pointermove={movePan}
  on:pointerup={endPan}
  on:pointercancel={endPan}
>
  <svg class="world-stage" viewBox={`0 0 ${viewportWidth} ${viewportHeight}`} role="img" aria-label="世界平面地图与旅行轨迹">
    <defs>
      <pattern id="star-grid" width="88" height="88" patternUnits="userSpaceOnUse">
        <path d="M 88 0 L 0 0 0 88" fill="none" stroke="rgba(35, 95, 115, 0.08)" stroke-width="1" />
        <circle cx="0" cy="0" r="1.4" fill="rgba(221, 111, 92, 0.2)" />
      </pattern>
      <linearGradient id="ocean-sheen" x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0%" stop-color="#dff2f2" />
        <stop offset="45%" stop-color="#f8fbf7" />
        <stop offset="100%" stop-color="#e7f0e3" />
      </linearGradient>
      <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="10" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <marker id="route-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#235f73" />
      </marker>
    </defs>

    <rect width={viewportWidth} height={viewportHeight} fill="url(#star-grid)" opacity="0.9" />

    <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
      <path class="sphere" d={spherePath} />
      <path class="graticule" d={graticulePath} />

      {#each countryFeatures as country, index (index)}
        <path class="country" d={pathGenerator(country)} />
      {/each}

      {#each plottedTrips as trip (trip.id)}
        <g class="trip-routes" style={`--trip-color: ${trip.color}`}>
          {#each trip.legs as leg, index (leg.id)}
            <path
              class={`route-line ${transportClass(leg.transport)}`}
              d={routePath(trip, leg, index)}
              stroke-dasharray={transportDash(leg.transport)}
              marker-end="url(#route-arrow)"
            />
          {/each}
        </g>
      {/each}

      {#each plottedTrips as trip (trip.id)}
        <g class="trip-nodes" style={`--trip-color: ${trip.color}`}>
          {#each trip.visits as visit (visit.id)}
            <g
              class:selected={visit.id === selectedVisitId}
              class="visit-node"
              role="button"
              tabindex="0"
              aria-label={`${visit.location.name}，${formatMonth(visit.arrivedAt)}`}
              transform={`translate(${visit.x} ${visit.y})`}
              on:pointerdown|stopPropagation
              on:click|stopPropagation={() => selectNode(visit)}
              on:keydown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') selectNode(visit);
              }}
            >
              <circle class="node-aura" r={18 + visit.rating * 3.8} />
              <circle class="node-core" r={5 + visit.rating * 1.6} />
              <text class="node-label" x="18" y="-13">
                <tspan class="node-date">{formatMonth(visit.arrivedAt)}</tspan>
                <tspan x="18" dy="17">{visit.location.name}</tspan>
              </text>
            </g>
          {/each}
        </g>
      {/each}
    </g>
  </svg>

  <div
    class="canvas-controls glass-panel"
    role="group"
    aria-label="画布控制"
    on:pointerdown={stopControlEvent}
    on:pointermove={stopControlEvent}
    on:pointerup={stopControlEvent}
    on:pointercancel={stopControlEvent}
    on:wheel|preventDefault={stopControlEvent}
  >
    <button
      type="button"
      class="icon-button"
      aria-label="放大"
      title="放大"
      on:click|stopPropagation={() => zoomAt(1.16)}
    >
      <ZoomIn size={18} />
    </button>
    <button
      type="button"
      class="icon-button"
      aria-label="缩小"
      title="缩小"
      on:click|stopPropagation={() => zoomAt(0.86)}
    >
      <ZoomOut size={18} />
    </button>
    <button
      type="button"
      class="icon-button"
      aria-label="重置视图"
      title="重置"
      on:click|stopPropagation={fitWorld}
    >
      <RotateCcw size={18} />
    </button>
    <button
      type="button"
      class="icon-button"
      aria-label={playing ? '暂停播放' : '播放轨迹'}
      aria-pressed={playing}
      title={playing ? '暂停' : '播放'}
      on:click|stopPropagation={togglePlayback}
    >
      {#if playing}
        <Pause size={18} />
      {:else}
        <Play size={18} />
      {/if}
    </button>
    <button
      type="button"
      class="icon-button accent"
      aria-label="新增旅行节点"
      title="新增"
      on:click|stopPropagation={handleCreate}
    >
      <Plus size={18} />
    </button>
    <output class="control-readout" aria-live="polite">{zoomLabel}</output>
    <span class="sr-only" aria-live="polite">{controlStatus}</span>
  </div>
</section>

<style>
  .canvas-shell {
    position: fixed;
    inset: 0;
    cursor: grab;
    overflow: hidden;
    touch-action: none;
  }

  .canvas-shell:active {
    cursor: grabbing;
  }

  .world-stage {
    width: 100%;
    height: 100%;
  }

  .sphere {
    fill: url(#ocean-sheen);
    stroke: rgba(35, 95, 115, 0.16);
    stroke-width: 1.4;
  }

  .graticule {
    fill: none;
    stroke: rgba(35, 95, 115, 0.13);
    stroke-width: 1;
  }

  .country {
    fill: rgba(255, 255, 255, 0.54);
    stroke: rgba(71, 103, 101, 0.2);
    stroke-width: 0.72;
    vector-effect: non-scaling-stroke;
  }

  .route-line {
    fill: none;
    stroke-linecap: round;
    stroke-width: 4;
    opacity: 0.78;
    vector-effect: non-scaling-stroke;
    filter: drop-shadow(0 10px 14px rgba(24, 51, 60, 0.16));
  }

  .visit-node {
    cursor: pointer;
    outline: none;
  }

  .visit-node:focus-visible .node-aura,
  .visit-node.selected .node-aura {
    stroke: rgba(255, 255, 255, 0.92);
    stroke-width: 2.2;
  }

  .node-aura {
    fill: var(--trip-color);
    opacity: 0.18;
    filter: url(#soft-glow);
  }

  .node-core {
    fill: var(--trip-color);
    stroke: #fff;
    stroke-width: 2;
    filter: drop-shadow(0 6px 12px rgba(24, 44, 51, 0.24));
  }

  .node-label {
    pointer-events: none;
    fill: #1e343e;
    font-size: 15px;
    font-weight: 800;
    paint-order: stroke;
    stroke: rgba(255, 255, 255, 0.84);
    stroke-linejoin: round;
    stroke-width: 4px;
  }

  .node-date {
    fill: #667a80;
    font-size: 12px;
    font-weight: 700;
  }

  .canvas-controls {
    position: fixed;
    z-index: 24;
    top: 20px;
    left: 50%;
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: 999px;
    padding: 8px;
    transform: translateX(-50%);
    cursor: default;
    touch-action: manipulation;
  }

  .canvas-controls .accent {
    background: #235f73;
    color: #fff;
  }

  .control-readout {
    display: inline-grid;
    min-width: 56px;
    min-height: 44px;
    place-items: center;
    border: 1px solid rgba(31, 54, 63, 0.1);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.62);
    color: #263c45;
    font-size: 13px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
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
    .canvas-controls {
      top: auto;
      right: 12px;
      bottom: 102px;
      left: auto;
      transform: none;
    }
  }
</style>
