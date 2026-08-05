<script lang="ts">
  import { Search, MapPin, Loader2 } from '@lucide/svelte';
  import { countryFeatures, countryAt, pathGenerator, projection, MAP_WIDTH, MAP_HEIGHT } from '$lib/geo';
  import { clampContainedPan } from '$lib/map/clampPan';
  import { panForZoomAt } from '$lib/map/panZoom';
  import { searchPlaces, type Place } from '$lib/gazetteer';

  export let name: string = '';
  export let country: string = '';
  export let lat: number | string = '';
  export let lng: number | string = '';
  export let onPick: (place: { name?: string; country?: string; lat: number; lng: number }) => void = () => {};

  const countryPaths = countryFeatures.map((feature) => pathGenerator(feature) ?? '');

  let query = '';
  let results: Place[] = [];
  let highlight = -1;
  let open = false;
  let searching = false;
  let loadError = false;
  let searchToken = 0;
  let debounce: ReturnType<typeof setTimeout> | undefined;

  // Mini-map view state (independent from the main canvas).
  let svgEl: SVGSVGElement;
  let mapGroup: SVGGElement;
  let pan = { x: 0, y: 0 };
  let zoom = 1;
  let dragging = false;
  let moved = false;
  let lastPointer = { x: 0, y: 0 };

  $: latNum = typeof lat === 'number' ? lat : parseFloat(lat);
  $: lngNum = typeof lng === 'number' ? lng : parseFloat(lng);
  $: hasMarker = Number.isFinite(latNum) && Number.isFinite(lngNum);
  $: marker = hasMarker ? projection([lngNum, latNum]) ?? null : null;

  function onInput() {
    clearTimeout(debounce);
    const value = query;
    if (!value.trim()) {
      results = [];
      open = false;
      searching = false;
      return;
    }
    debounce = setTimeout(() => runSearch(value), 120);
  }

  async function runSearch(value: string) {
    const token = ++searchToken;
    searching = true;
    loadError = false;
    try {
      const found = await searchPlaces(value);
      if (token !== searchToken) return;
      results = found;
      highlight = found.length ? 0 : -1;
      open = true;
    } catch {
      if (token !== searchToken) return;
      loadError = true;
      results = [];
      open = true;
    } finally {
      if (token === searchToken) searching = false;
    }
  }

  function selectResult(place: Place) {
    onPick({ name: place.name, country: place.country, lat: place.lat, lng: place.lng });
    query = '';
    results = [];
    open = false;
    highlight = -1;
  }

  function onSearchKeydown(event: KeyboardEvent) {
    // Never let the search box submit the enclosing form.
    if (event.key === 'Enter') event.preventDefault();
    if (!open || results.length === 0) {
      if (event.key === 'Escape') open = false;
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      highlight = (highlight + 1) % results.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      highlight = (highlight - 1 + results.length) % results.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (highlight >= 0) selectResult(results[highlight]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      open = false;
    }
  }

  function screenToView(clientX: number, clientY: number) {
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: point.x, y: point.y };
  }

  function handleWheel(event: WheelEvent) {
    event.preventDefault();
    const view = screenToView(event.clientX, event.clientY);
    const prevZoom = zoom;
    const nextZoom = Math.min(8, Math.max(1, prevZoom * (event.deltaY > 0 ? 0.85 : 1.18)));
    zoom = nextZoom;
    pan = clampContainedPan(
      panForZoomAt(pan, prevZoom, nextZoom, view),
      nextZoom,
      { mapWidth: MAP_WIDTH, mapHeight: MAP_HEIGHT }
    );
  }

  function clampPan() {
    pan = clampContainedPan(pan, zoom, { mapWidth: MAP_WIDTH, mapHeight: MAP_HEIGHT });
  }

  function startDrag(event: PointerEvent) {
    if (event.button !== 0) return;
    dragging = true;
    moved = false;
    lastPointer = { x: event.clientX, y: event.clientY };
    svgEl.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent) {
    if (!dragging) return;
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    const from = screenToView(lastPointer.x, lastPointer.y);
    const to = screenToView(event.clientX, event.clientY);
    pan = { x: pan.x + (to.x - from.x), y: pan.y + (to.y - from.y) };
    lastPointer = { x: event.clientX, y: event.clientY };
    clampPan();
  }

  function endDrag(event: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    if (svgEl.hasPointerCapture(event.pointerId)) svgEl.releasePointerCapture(event.pointerId);
    if (!moved) pickAt(event.clientX, event.clientY);
  }

  function pickAt(clientX: number, clientY: number) {
    const ctm = mapGroup.getScreenCTM();
    if (!ctm) return;
    const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    const inverted = projection.invert?.([point.x, point.y]);
    if (!inverted) return;
    const [pickedLng, pickedLat] = inverted;
    if (!Number.isFinite(pickedLat) || !Number.isFinite(pickedLng)) return;
    if (Math.abs(pickedLat) > 90 || Math.abs(pickedLng) > 180) return;
    const roundedLat = Number(pickedLat.toFixed(4));
    const roundedLng = Number(pickedLng.toFixed(4));
    onPick({ country: countryAt(roundedLng, roundedLat), lat: roundedLat, lng: roundedLng });
  }

  function coordLabel(value: number): string {
    return Number.isFinite(value) ? value.toFixed(4) : '—';
  }
</script>

<div class="location-picker">
  <div class="search-box">
    <div class="search-input">
      <Search size={16} class="search-icon" />
      <input
        class="field"
        type="text"
        autocomplete="off"
        placeholder="搜索城市，如「京都」「Kyoto」"
        bind:value={query}
        on:input={onInput}
        on:keydown={onSearchKeydown}
        on:focus={() => {
          if (results.length || loadError) open = true;
        }}
      />
      {#if searching}
        <Loader2 size={16} class="spin" />
      {/if}
    </div>

    {#if open}
      <ul class="results" role="listbox">
        {#if loadError}
          <li class="result-empty">地名库加载失败，可用下方地图点选</li>
        {:else if results.length === 0}
          <li class="result-empty">没有匹配的地点</li>
        {:else}
          {#each results as place, index (place.countryCode + place.name + place.lat)}
            <li>
              <button
                type="button"
                class="result"
                class:active={index === highlight}
                role="option"
                aria-selected={index === highlight}
                on:mouseenter={() => (highlight = index)}
                on:click={() => selectResult(place)}
              >
                <span class="result-name">
                  <strong>{place.nameZh || place.nameEn}</strong>
                  {#if place.nameZh && place.nameEn}<em>{place.nameEn}</em>{/if}
                </span>
                <span class="result-meta">
                  {place.country} · {place.lat.toFixed(2)}, {place.lng.toFixed(2)}
                </span>
              </button>
            </li>
          {/each}
        {/if}
      </ul>
    {/if}
  </div>

  <div class="map-frame">
    <svg
      bind:this={svgEl}
      class="mini-map"
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      role="application"
      aria-label="点击地图选择坐标"
      on:wheel={handleWheel}
      on:pointerdown={startDrag}
      on:pointermove={moveDrag}
      on:pointerup={endDrag}
      on:pointercancel={endDrag}
    >
      <g bind:this={mapGroup} transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
        <rect class="mini-ocean" x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} />
        {#each countryPaths as d, index (index)}
          <path class="mini-country" {d} />
        {/each}
        {#if marker}
          <g class="mini-marker" transform={`translate(${marker[0]} ${marker[1]})`}>
            <circle class="marker-aura" r={26 / zoom} />
            <circle class="marker-core" r={11 / zoom} />
          </g>
        {/if}
      </g>
    </svg>

    <div class="map-readout">
      <MapPin size={13} />
      {#if name || country}
        <span class="map-place">{[name, country].filter(Boolean).join(' · ')}</span>
      {/if}
      <span>纬度 {coordLabel(latNum)} · 经度 {coordLabel(lngNum)}</span>
      <span class="map-hint">点击地图取点 · 滚轮缩放</span>
    </div>
  </div>
</div>

<style>
  .location-picker {
    display: grid;
    gap: 10px;
  }

  .search-box {
    position: relative;
  }

  .search-input {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .search-input :global(.search-icon) {
    flex: 0 0 auto;
    color: #6a7f85;
  }

  .search-input .field {
    flex: 1;
  }

  .search-input :global(.spin) {
    flex: 0 0 auto;
    color: #2d7c89;
    animation: picker-spin 0.9s linear infinite;
  }

  @keyframes picker-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .results {
    position: absolute;
    z-index: 5;
    top: calc(100% + 6px);
    right: 0;
    left: 0;
    max-height: 260px;
    margin: 0;
    padding: 6px;
    overflow: auto;
    list-style: none;
    border: 1px solid rgba(31, 54, 63, 0.14);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 18px 40px rgba(24, 44, 51, 0.16);
    backdrop-filter: blur(12px);
  }

  .result {
    display: grid;
    width: 100%;
    gap: 3px;
    border: none;
    border-radius: 8px;
    background: transparent;
    padding: 8px 10px;
    text-align: left;
    cursor: pointer;
  }

  .result.active {
    background: rgba(45, 124, 137, 0.12);
  }

  .result-name {
    display: flex;
    align-items: baseline;
    gap: 8px;
    color: #172832;
  }

  .result-name strong {
    font-size: 14px;
    font-weight: 800;
  }

  .result-name em {
    color: #667a80;
    font-size: 12px;
    font-style: normal;
  }

  .result-meta {
    color: #6a7f85;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .result-empty {
    padding: 12px 10px;
    color: #6a7f85;
    font-size: 13px;
    text-align: center;
  }

  .map-frame {
    overflow: hidden;
    border: 1px solid rgba(31, 54, 63, 0.12);
    border-radius: 10px;
    background: #eef5f4;
  }

  .mini-map {
    display: block;
    width: 100%;
    height: 220px;
    cursor: crosshair;
    touch-action: none;
  }

  .mini-ocean {
    fill: #dbeceb;
  }

  .mini-country {
    fill: rgba(255, 255, 255, 0.9);
    stroke: rgba(71, 103, 101, 0.32);
    stroke-width: 0.8;
    vector-effect: non-scaling-stroke;
  }

  .marker-aura {
    fill: #dd6f5c;
    opacity: 0.24;
  }

  .marker-core {
    fill: #dd6f5c;
    stroke: #fff;
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }

  .map-readout {
    display: flex;
    align-items: center;
    gap: 8px;
    border-top: 1px solid rgba(31, 54, 63, 0.1);
    background: rgba(255, 255, 255, 0.72);
    padding: 7px 10px;
    color: #304751;
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .map-readout :global(svg) {
    color: #2d7c89;
  }

  .map-place {
    color: #172832;
    font-weight: 800;
  }

  .map-hint {
    margin-left: auto;
    color: #869499;
    font-weight: 600;
  }
</style>
