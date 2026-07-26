<script lang="ts">
  import { ArrowLeft, BarChart3, CalendarDays, MapPinned, Route, Star } from '@lucide/svelte';
  import BarChart from './stats/BarChart.svelte';
  import StatCard from './stats/StatCard.svelte';
  import { formatDistanceKm } from '$lib/format';
  import { computeStatsSnapshot } from '$lib/stats/compute';
  import { filterVisits } from '$lib/stats/filter';
  import type { Leg, Visit } from '$lib/types';

  export let visits: Visit[] = [];
  export let legs: Leg[] = [];
  export let years: number[] = [];
  export let yearColors: Record<string, string> = {};
  export let statsYear: number | 'all' = 'all';
  export let loading = false;
  export let onBack: () => void = () => {};
  export let onStatsYearChange: (year: number | 'all') => void = () => {};

  $: filteredVisits = filterVisits(visits, statsYear);
  $: snapshot = computeStatsSnapshot(filteredVisits, statsYear, yearColors, legs);
  $: kpi = snapshot.kpi;
</script>

<div class="stats-view" aria-label="旅行统计">
  <header class="stats-header glass-panel">
    <button type="button" class="back-button" on:click={onBack}>
      <ArrowLeft size={18} />返回地图
    </button>
    <div class="title-block">
      <BarChart3 size={20} />
      <h2>旅行统计</h2>
    </div>
    <div class="year-filter" aria-label="统计年份筛选">
      <button type="button" class:active={statsYear === 'all'} on:click={() => onStatsYearChange('all')}>
        所有年份
      </button>
      {#each years as year (year)}
        <button
          type="button"
          style={`--trip-color: ${yearColors[String(year)] || '#2d7c89'}`}
          class:active={statsYear === year}
          on:click={() => onStatsYearChange(year)}
        >
          <span></span>{year}
        </button>
      {/each}
    </div>
  </header>

  {#if loading}
    <p class="state-text">正在载入旅行数据…</p>
  {:else if snapshot.isEmpty}
    <div class="empty-panel glass-panel">
      <p>{statsYear === 'all' ? '暂无旅行记录' : `${statsYear} 年暂无旅行记录`}</p>
      <p class="hint">在地图上新增节点后，统计会自动更新。</p>
    </div>
  {:else}
    <div class="kpi-row" aria-label="核心指标">
      <div class="kpi-card glass-panel">
        <Route size={17} />
        <span>{kpi.visitCount}</span>
        <small>节点</small>
      </div>
      <div class="kpi-card glass-panel">
        <MapPinned size={17} />
        <span>{kpi.countryCount}</span>
        <small>地区</small>
      </div>
      <div class="kpi-card glass-panel">
        <Route size={17} />
        <span>{formatDistanceKm(kpi.totalDistanceKm)}</span>
        <small>总里程</small>
      </div>
      <div class="kpi-card glass-panel">
        <Star size={17} />
        <span>{kpi.averageRating ?? '—'}</span>
        <small>均分</small>
      </div>
      <div class="kpi-card glass-panel">
        <CalendarDays size={17} />
        <span>{kpi.spanLabel}</span>
        <small>跨度</small>
      </div>
    </div>

    <div class="module-grid">
      <StatCard title="时间趋势" summary={snapshot.timeTrend.summary}>
        <BarChart
          items={snapshot.timeTrend.bars}
          ariaLabel={snapshot.timeTrend.mode === 'yearly' ? '按年访问频次' : '按月访问频次'}
        />
      </StatCard>

      <StatCard
        title="交通里程"
        summary={snapshot.transportDistance.length ? '按站间连线大圆距离汇总' : '暂无路段里程'}
      >
        {#if snapshot.transportDistance.length}
          <BarChart items={snapshot.transportDistance} valueSuffix=" km" ariaLabel="各交通方式里程" />
        {:else}
          <p class="hint">新增至少两站后，将按相邻节点计算里程。</p>
        {/if}
      </StatCard>

      <StatCard title="地理分布">
        <p class="section-label">国家 Top 8</p>
        <BarChart items={snapshot.geo.countries} ariaLabel="国家访问排行" />
        <p class="section-label">地点 Top 8</p>
        <BarChart items={snapshot.geo.places} ariaLabel="地点访问排行" />
        {#if snapshot.geo.table.length}
          <div class="country-table-wrap">
            <table class="country-table">
              <thead>
                <tr>
                  <th>国家</th>
                  <th>次数</th>
                  <th>首次</th>
                </tr>
              </thead>
              <tbody>
                {#each snapshot.geo.table as row (row.country)}
                  <tr>
                    <td>{row.country}</td>
                    <td>{row.count}</td>
                    <td>{row.firstYear || '—'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </StatCard>

      <StatCard title="评分分析">
        {#if snapshot.rating.hasRatings}
          <ul class="rating-buckets" aria-label="评分分布">
            {#each snapshot.rating.buckets as bucket (bucket.star)}
              <li>
                <span>{bucket.star} 星</span>
                <div class="track" aria-hidden="true">
                  <div class="fill" style={`width: ${bucket.percent}%`}></div>
                </div>
                <span class="meta">{bucket.count} · {bucket.percent}%</span>
              </li>
            {/each}
          </ul>
          {#if snapshot.rating.yearlyAverage.length}
            <p class="section-label">均分按年</p>
            <BarChart
              items={snapshot.rating.yearlyAverage}
              ariaLabel="年度均分"
              valueSuffix=""
              maxValue={5}
            />
          {/if}
          {#if snapshot.rating.topPlaces.length}
            <p class="section-label">高分地点 Top 5</p>
            <ul class="top-list">
              {#each snapshot.rating.topPlaces as place (`${place.name}-${place.rating}`)}
                <li>
                  <span>{place.name}</span>
                  <span class="meta">{place.rating.toFixed(1)}</span>
                </li>
              {/each}
            </ul>
          {/if}
        {:else}
          <p class="empty-copy">暂无评分数据</p>
        {/if}
      </StatCard>

      <StatCard
        title="标签与主题"
        summary={snapshot.tags.uniqueCount
          ? `共 ${snapshot.tags.uniqueCount} 个不同标签，${snapshot.tags.totalMarks} 次标记`
          : ''}
      >
        {#if snapshot.tags.tags.length}
          <BarChart items={snapshot.tags.tags} ariaLabel="热门标签排行" />
        {:else}
          <p class="empty-copy">为旅行节点添加标签，解锁主题分析</p>
        {/if}
      </StatCard>
    </div>
  {/if}
</div>

<style>
  .stats-view {
    position: fixed;
    z-index: 30;
    inset: 0;
    overflow: auto;
    padding: 22px 24px;
    background:
      radial-gradient(circle at 18% 12%, rgba(226, 112, 91, 0.12), transparent 24rem),
      radial-gradient(circle at 82% 8%, rgba(65, 132, 145, 0.14), transparent 28rem),
      linear-gradient(160deg, #eef7f6 0%, #faf7f2 52%, #edf4ef 100%);
  }

  .stats-header {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 12px 16px;
    margin-bottom: 18px;
    border-radius: 12px;
    padding: 14px 18px;
  }

  .back-button {
    display: inline-flex;
    min-height: 40px;
    align-items: center;
    gap: 6px;
    border: 1px solid rgba(31, 54, 63, 0.12);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.72);
    color: #243942;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 600;
    transition:
      border-color 160ms ease,
      background 160ms ease,
      transform 160ms ease;
  }

  .back-button:hover {
    border-color: rgba(35, 95, 115, 0.34);
    background: rgba(255, 255, 255, 0.96);
    transform: translateY(-1px);
  }

  .title-block {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #225f73;
  }

  .title-block h2 {
    margin: 0;
    color: #172832;
    font-size: 18px;
    font-weight: 800;
  }

  .year-filter {
    display: flex;
    grid-column: 1 / -1;
    flex-wrap: wrap;
    gap: 8px;
  }

  .year-filter button {
    display: inline-flex;
    min-height: 36px;
    align-items: center;
    gap: 7px;
    border: 1px solid rgba(31, 54, 63, 0.11);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.58);
    color: #263c45;
    padding: 0 12px;
    font-size: 13px;
    transition:
      border-color 160ms ease,
      background 160ms ease;
  }

  .year-filter button.active,
  .year-filter button:hover {
    border-color: rgba(35, 95, 115, 0.34);
    background: rgba(255, 255, 255, 0.94);
  }

  .year-filter span {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--trip-color, #2d7c89);
  }

  .state-text,
  .empty-panel {
    margin: 0;
    color: #4c646c;
    font-size: 14px;
  }

  .empty-panel {
    border-radius: 12px;
    padding: 28px 24px;
    text-align: center;
  }

  .hint {
    margin: 0;
    color: #6a8088;
    font-size: 13px;
    line-height: 1.5;
  }

  .empty-panel .hint {
    margin: 8px 0 0;
    color: #6a8088;
    font-size: 13px;
  }

  .kpi-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .kpi-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-radius: 12px;
    padding: 14px 14px 12px;
    color: #2d7c89;
  }

  .kpi-card span {
    color: #192d37;
    font-size: 24px;
    font-variant-numeric: tabular-nums;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .kpi-card small {
    color: #687b82;
    font-size: 12px;
    font-weight: 600;
  }

  .module-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    align-items: start;
    padding-bottom: 28px;
  }

  .section-label {
    margin: 16px 0 10px;
    color: #5a727a;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .section-label:first-child {
    margin-top: 0;
  }

  .country-table-wrap {
    margin-top: 14px;
    overflow: auto;
    border: 1px solid rgba(31, 54, 63, 0.08);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.42);
  }

  .country-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .country-table th,
  .country-table td {
    border-bottom: 1px solid rgba(31, 54, 63, 0.07);
    padding: 9px 12px;
    text-align: left;
  }

  .country-table tr:last-child td {
    border-bottom: none;
  }

  .country-table th {
    color: #607880;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    background: rgba(31, 54, 63, 0.03);
  }

  .country-table td {
    color: #243942;
    font-variant-numeric: tabular-nums;
  }

  .rating-buckets {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rating-buckets li {
    display: grid;
    grid-template-columns: 44px 1fr auto;
    align-items: center;
    gap: 10px 12px;
    border-radius: 10px;
    padding: 4px 6px 4px 4px;
    color: #3d555e;
    font-size: 13px;
    font-weight: 600;
    transition: background 160ms ease;
  }

  .rating-buckets li:hover {
    background: rgba(45, 124, 137, 0.06);
  }

  .track {
    height: 16px;
    overflow: hidden;
    border: 1px solid rgba(31, 54, 63, 0.06);
    border-radius: 999px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.55), transparent),
      rgba(31, 54, 63, 0.07);
    box-shadow: inset 0 1px 2px rgba(25, 47, 65, 0.06);
  }

  .fill {
    height: 100%;
    min-width: 4px;
    border-radius: inherit;
    background: linear-gradient(90deg, #2d7c89, #6d8f58);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.28),
      0 1px 3px rgba(45, 124, 137, 0.18);
    transition: width 280ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .meta {
    color: #5f757d;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    white-space: nowrap;
  }

  .top-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .top-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border-radius: 10px;
    padding: 8px 10px;
    font-size: 13px;
    font-weight: 600;
    color: #243942;
    background: rgba(255, 255, 255, 0.36);
  }

  .top-list .meta {
    color: #2d7c89;
    font-size: 13px;
    font-weight: 700;
  }

  .empty-copy {
    margin: 0;
    color: #6a8088;
    font-size: 13px;
    line-height: 1.55;
  }

  @media (max-width: 980px) {
    .stats-view {
      padding: 14px;
    }

    .kpi-row,
    .module-grid {
      grid-template-columns: 1fr;
    }

    .stats-header {
      grid-template-columns: 1fr;
    }

    .title-block {
      order: -1;
    }
  }
</style>
