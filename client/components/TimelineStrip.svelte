<script>
  import { formatMonth, ratingText } from '$lib/format';

  export let trips = [];
  export let selectedVisitId = null;
  export let onSelectVisit = () => {};

  $: visits = trips
    .flatMap((trip) => trip.visits.map((visit) => ({ ...visit, trip })))
    .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
</script>

<nav class="timeline glass-panel" aria-label="旅行时间轴">
  {#each visits as visit (visit.id)}
    <button
      type="button"
      class:active={visit.id === selectedVisitId}
      style={`--trip-color: ${visit.trip.color}`}
      aria-label={`${visit.location.name}，${formatMonth(visit.arrivedAt)}`}
      on:click={() => onSelectVisit(visit.id)}
    >
      <span class="dot"></span>
      <span class="date">{formatMonth(visit.arrivedAt)}</span>
      <strong>{visit.location.name}</strong>
      <small>{ratingText(visit.rating)}</small>
    </button>
  {/each}
</nav>

<style>
  .timeline {
    position: fixed;
    z-index: 22;
    right: 400px;
    bottom: 20px;
    left: 358px;
    display: flex;
    gap: 8px;
    min-height: 88px;
    overflow-x: auto;
    border-radius: 8px;
    padding: 10px;
    scrollbar-width: thin;
  }

  button {
    position: relative;
    display: grid;
    min-width: 156px;
    min-height: 66px;
    grid-template-columns: 14px 1fr;
    column-gap: 8px;
    align-items: center;
    border: 1px solid rgba(31, 54, 63, 0.11);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.62);
    color: #1f343e;
    cursor: pointer;
    padding: 9px 10px;
    text-align: left;
    transition:
      transform 170ms ease,
      border-color 170ms ease,
      background 170ms ease;
  }

  button::before {
    position: absolute;
    top: 50%;
    right: 100%;
    width: 8px;
    height: 1px;
    background: rgba(45, 124, 137, 0.28);
    content: '';
  }

  button:first-child::before {
    display: none;
  }

  button:hover,
  button.active {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--trip-color) 48%, transparent);
    background: #fff;
  }

  .dot {
    width: 10px;
    height: 10px;
    grid-row: 1 / span 3;
    border-radius: 999px;
    background: var(--trip-color);
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--trip-color) 16%, transparent);
  }

  .date {
    color: #6d7d83;
    font-size: 12px;
    line-height: 1.2;
  }

  strong {
    overflow-wrap: anywhere;
    font-size: 14px;
    line-height: 1.15;
  }

  small {
    color: #a46c21;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 980px) {
    .timeline {
      right: 12px;
      bottom: 12px;
      left: 12px;
      min-height: 82px;
    }

    button {
      min-width: 138px;
    }
  }
</style>
