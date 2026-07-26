<script lang="ts">
  import type { BarItem } from '$lib/stats/types';

  export let items: BarItem[] = [];
  export let ariaLabel = '';
  export let valueSuffix = '';
  export let emptyText = '暂无数据';
  export let maxValue: number | null = null;

  $: peak = maxValue ?? Math.max(1, ...items.map((item) => item.value));
</script>

<div class="bar-chart" aria-label={ariaLabel}>
  {#if items.length === 0}
    <p class="empty">{emptyText}</p>
  {:else}
    <ul>
      {#each items as item (item.label)}
        <li style={`--bar-color: ${item.color || '#2d7c89'}`}>
          <span class="label" title={item.label}>{item.label}</span>
          <div class="track" aria-hidden="true">
            <div class="fill" style={`width: ${(item.value / peak) * 100}%`}></div>
          </div>
          <span class="value">{item.value}{valueSuffix}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .bar-chart {
    min-height: 4rem;
  }

  .bar-chart ul {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .bar-chart li {
    display: grid;
    grid-template-columns: minmax(56px, 88px) 1fr minmax(36px, auto);
    align-items: center;
    gap: 10px 12px;
    border-radius: 10px;
    padding: 4px 6px 4px 4px;
    transition: background 160ms ease;
  }

  .bar-chart li:hover {
    background: rgba(45, 124, 137, 0.06);
  }

  .label {
    overflow: hidden;
    color: #3d555e;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.01em;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    background: linear-gradient(
      90deg,
      var(--bar-color),
      color-mix(in srgb, var(--bar-color) 72%, #ffffff)
    );
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.28),
      0 1px 3px color-mix(in srgb, var(--bar-color) 28%, transparent);
    transition: width 280ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .value {
    color: #182c36;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    letter-spacing: -0.01em;
    text-align: right;
  }

  .empty {
    margin: 0;
    color: #6a8088;
    font-size: 13px;
    line-height: 1.55;
  }

  @media (max-width: 640px) {
    .bar-chart li {
      grid-template-columns: minmax(48px, 72px) 1fr minmax(32px, auto);
      gap: 8px 10px;
      padding: 2px 4px 2px 2px;
    }

    .track {
      height: 14px;
    }
  }
</style>
