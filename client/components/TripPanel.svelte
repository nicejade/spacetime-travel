<script lang="ts">
  import {
    CalendarDays,
    MapPin,
    NotebookText,
    Pencil,
    Plane,
    Star,
    Tag,
    Trash2,
    Utensils
  } from '@lucide/svelte';
  import { formatDate, ratingText, splitTags, transportLabel } from '$lib/format';
  import type { AtlasStats, Visit } from '$lib/types';

  export let visit: Visit | null = null;
  export let year: number | null = null;
  export let yearColor = '#2d7c89';
  export let visits: Visit[] = [];
  export let stats: AtlasStats = {
    visitCount: 0,
    countryCount: 0,
    averageRating: 0,
    startYear: null,
    endYear: null
  };
  export let onEdit: (visit: Visit) => void = () => {};
  export let onDelete: (visit: Visit) => void = () => {};

  let lastVisitId: number | null = null;
  let animateEnter = false;

  $: tags = splitTags(visit?.tags);
  $: countries = [...new Set(visits.map((item) => item.location.country))];
  $: {
    if (visit) {
      animateEnter = lastVisitId != null && lastVisitId !== visit.id;
      lastVisitId = visit.id;
    } else {
      animateEnter = false;
      lastVisitId = null;
    }
  }
</script>

<aside class="detail-panel glass-panel" aria-label="旅行节点详情">
  {#if visit && year !== null}
    {#key visit.id}
      <div
        class="panel-body"
        class:panel-body--enter={animateEnter}
        style={`--trip-color: ${yearColor}`}
      >
        <div class="panel-head">
          <span class="trip-chip">{year}</span>
          <h2>{visit.location.name}</h2>
          <p>{visit.location.country}</p>
        </div>

        <div class="quick-facts">
          <div>
            <CalendarDays size={16} />
            <span>{formatDate(visit.arrivedAt)} - {formatDate(visit.departedAt)}</span>
          </div>
          <div>
            <MapPin size={16} />
            <span>从 {visit.origin.name} 出发</span>
          </div>
          <div>
            <Plane size={16} />
            <span>去程：{transportLabel(visit.outboundTransport)}</span>
          </div>
          {#if visit.returnsToOrigin}
            <div>
              <Plane size={16} />
              <span>返程：{transportLabel(visit.returnTransport ?? visit.outboundTransport)}</span>
            </div>
          {:else}
            <span class="one-way-badge">未返回起点</span>
          {/if}
          {#if visit.inboundTransport}
            <div>
              <Plane size={16} />
              <span>站间：{transportLabel(visit.inboundTransport)}</span>
            </div>
          {/if}
          <div>
            <Star size={16} />
            <span>{ratingText(visit.rating)}</span>
          </div>
          <div>
            <MapPin size={16} />
            <span>{visit.location.lat.toFixed(2)}, {visit.location.lng.toFixed(2)}</span>
          </div>
        </div>

        <section>
          <h3><NotebookText size={16} />感受</h3>
          <p>{visit.feeling || '未记录'}</p>
        </section>

        <section>
          <h3><Utensils size={16} />饮食</h3>
          <p>{visit.food || '未记录'}</p>
        </section>

        <section>
          <h3><Tag size={16} />标签</h3>
          {#if tags.length}
            <div class="tag-list">
              {#each tags as tag}
                <span>{tag}</span>
              {/each}
            </div>
          {:else}
            <p>未记录</p>
          {/if}
        </section>

        {#if visit.memory || visit.weather || visit.mood || visit.inboundNote}
          <div class="memory-grid">
            {#if visit.mood}
              <div>
                <small>心境</small>
                <strong>{visit.mood}</strong>
              </div>
            {/if}
            {#if visit.weather}
              <div>
                <small>天气</small>
                <strong>{visit.weather}</strong>
              </div>
            {/if}
            {#if visit.memory}
              <div>
                <small>片段</small>
                <strong>{visit.memory}</strong>
              </div>
            {/if}
            {#if visit.inboundNote}
              <div>
                <small>站间</small>
                <strong>{visit.inboundNote}</strong>
              </div>
            {/if}
          </div>
        {/if}

        <div class="panel-actions">
          <button type="button" class="secondary-button" on:click={() => onEdit(visit)}>
            <Pencil size={16} />编辑
          </button>
          <button type="button" class="danger-button" on:click={() => onDelete(visit)}>
            <Trash2 size={16} />删除
          </button>
        </div>
      </div>
    {/key}
  {:else}
    <div class="empty-panel">
      <span>{stats.visitCount ?? 0}</span>
      <h2>旅行图谱</h2>
      <p>{stats.visitCount ?? 0} 个节点，{stats.countryCount ?? 0} 个地区，平均评分 {stats.averageRating ?? 0}</p>
      <div class="country-cloud">
        {#each countries.slice(0, 10) as country}
          <span>{country}</span>
        {/each}
      </div>
    </div>
  {/if}
</aside>

<style>
  .detail-panel {
    position: fixed;
    z-index: 21;
    top: 20px;
    right: 20px;
    bottom: 126px;
    width: min(362px, calc(100vw - 40px));
    overflow: auto;
    border-radius: 8px;
    padding: 18px;
  }

  .panel-body--enter {
    animation: panel-enter 220ms ease-out both;
  }

  @keyframes panel-enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .panel-body--enter {
      animation: none;
    }
  }

  .panel-head {
    border-bottom: 1px solid rgba(31, 54, 63, 0.11);
    padding-bottom: 15px;
  }

  .trip-chip {
    display: inline-flex;
    min-height: 28px;
    align-items: center;
    border: 1px solid color-mix(in srgb, var(--trip-color) 32%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--trip-color) 12%, white);
    color: #263c45;
    padding: 0 10px;
    font-size: 12px;
    font-weight: 800;
  }

  h2 {
    margin: 13px 0 4px;
    color: #172832;
    font-size: 28px;
    line-height: 1.1;
  }

  .panel-head p,
  section p,
  .empty-panel p {
    margin: 0;
    color: #536970;
    font-size: 14px;
    line-height: 1.65;
  }

  .quick-facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin: 15px 0;
  }

  .quick-facts div {
    min-height: 68px;
    border: 1px solid rgba(31, 54, 63, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.58);
    padding: 10px;
  }

  .quick-facts :global(svg),
  h3 :global(svg) {
    color: #2d7c89;
  }

  .quick-facts span {
    display: block;
    margin-top: 7px;
    color: #223842;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .one-way-badge {
    display: inline-flex;
    align-self: start;
    border-radius: 999px;
    background: rgba(196, 92, 38, 0.12);
    color: #9b4a1f;
    font-size: 12px;
    font-weight: 800;
    padding: 4px 10px;
  }

  section {
    margin-top: 16px;
  }

  h3 {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 0 0 8px;
    color: #213640;
    font-size: 14px;
  }

  .tag-list,
  .country-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .tag-list span,
  .country-cloud span {
    border: 1px solid rgba(31, 54, 63, 0.1);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.72);
    color: #40565e;
    padding: 6px 9px;
    font-size: 12px;
    font-weight: 700;
  }

  .memory-grid {
    display: grid;
    gap: 8px;
    margin-top: 16px;
  }

  .memory-grid div {
    border: 1px solid rgba(31, 54, 63, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.58);
    padding: 10px;
  }

  .memory-grid small {
    display: block;
    margin-bottom: 4px;
    color: #6a7b80;
    font-size: 12px;
  }

  .memory-grid strong {
    color: #20353f;
    font-size: 13px;
    line-height: 1.55;
  }

  .panel-actions {
    display: flex;
    gap: 8px;
    margin-top: 18px;
  }

  .panel-actions button {
    flex: 1;
  }

  .empty-panel {
    display: grid;
    min-height: 100%;
    align-content: center;
    gap: 12px;
    text-align: center;
  }

  .empty-panel > span {
    display: grid;
    width: 72px;
    height: 72px;
    place-items: center;
    justify-self: center;
    border-radius: 999px;
    background: #235f73;
    color: white;
    font-size: 28px;
    font-weight: 900;
  }

  .empty-panel h2 {
    margin: 0;
  }

  .country-cloud {
    justify-content: center;
  }

  @media (max-width: 980px) {
    .detail-panel {
      top: auto;
      right: 12px;
      bottom: 106px;
      left: 12px;
      width: auto;
      max-height: 34dvh;
      padding: 14px;
    }

    h2 {
      font-size: 22px;
    }

    .quick-facts {
      grid-template-columns: repeat(4, minmax(132px, 1fr));
      overflow-x: auto;
    }
  }
</style>
