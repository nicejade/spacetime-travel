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
        <li>
          <span class="label" title={item.label}>{item.label}</span>
          <div class="track" aria-hidden="true">
            <div
              class="fill"
              style={`width: ${(item.value / peak) * 100}%; background: ${item.color || '#2d7c89'}`}
            ></div>
          </div>
          <span class="value">{item.value}{valueSuffix}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .bar-chart ul {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .bar-chart li {
    display: grid;
    grid-template-columns: minmax(52px, 72px) 1fr minmax(28px, auto);
    align-items: center;
    gap: 8px;
  }

  .label {
    overflow: hidden;
    color: #4a6169;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .track {
    height: 8px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(31, 54, 63, 0.08);
  }

  .fill {
    height: 100%;
    min-width: 2px;
    border-radius: inherit;
    transition: width 240ms ease;
  }

  .value {
    color: #1a3039;
    font-size: 12px;
    font-weight: 700;
    text-align: right;
  }

  .empty {
    margin: 0;
    color: #6a8088;
    font-size: 13px;
    line-height: 1.5;
  }
</style>
