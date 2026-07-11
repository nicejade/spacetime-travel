<script lang="ts">
  import { onMount } from 'svelte';
  import { Plane, Train, Ship, Car, Bus, Footprints, ChevronDown, Check } from '@lucide/svelte';
  import { transports } from '$lib/format';
  import type { Transport } from '$lib/types';

  export let value: Transport;

  const icons: Record<Transport, typeof Plane> = {
    flight: Plane,
    train: Train,
    ferry: Ship,
    drive: Car,
    bus: Bus,
    walk: Footprints
  };

  let open = false;
  let highlight = 0;
  let root: HTMLDivElement;
  let listId = `transport-list-${Math.random().toString(36).slice(2, 9)}`;

  $: selected = transports.find((item) => item.value === value) ?? transports[0];
  $: SelectedIcon = icons[selected.value];

  function toggle() {
    open = !open;
    if (open) {
      highlight = Math.max(
        0,
        transports.findIndex((item) => item.value === value)
      );
    }
  }

  function select(next: Transport) {
    value = next;
    open = false;
  }

  function onTriggerKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        open = true;
        highlight = Math.max(
          0,
          transports.findIndex((item) => item.value === value)
        );
        return;
      }
    }

    if (!open) return;

    if (event.key === 'ArrowDown') {
      highlight = (highlight + 1) % transports.length;
    } else if (event.key === 'ArrowUp') {
      highlight = (highlight - 1 + transports.length) % transports.length;
    } else if (event.key === 'Enter' || event.key === ' ') {
      select(transports[highlight].value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      open = false;
    } else if (event.key === 'Tab') {
      open = false;
    }
  }

  function handlePointerDown(event: PointerEvent) {
    if (!open || !root) return;
    if (!root.contains(event.target as Node)) open = false;
  }

  onMount(() => {
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  });
</script>

<div class="transport-select" bind:this={root}>
  <button
    type="button"
    class="trigger field"
    class:open
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls={listId}
    on:click={toggle}
    on:keydown={onTriggerKeydown}
  >
    <span class="trigger-content">
      <span class="option-icon" aria-hidden="true">
        <SelectedIcon size={16} />
      </span>
      <span class="trigger-label">{selected.label}</span>
    </span>
    <ChevronDown size={16} class={`chevron${open ? ' open' : ''}`} />
  </button>

  {#if open}
    <ul class="menu" id={listId} role="listbox" aria-label="前往方式">
      {#each transports as transport, index (transport.value)}
        {@const Icon = icons[transport.value]}
        <li role="presentation">
          <button
            type="button"
            class="option"
            class:active={index === highlight}
            class:selected={transport.value === value}
            role="option"
            aria-selected={transport.value === value}
            on:mouseenter={() => (highlight = index)}
            on:click={() => select(transport.value)}
          >
            <span class="option-icon" aria-hidden="true">
              <Icon size={16} />
            </span>
            <span class="option-label">{transport.label}</span>
            {#if transport.value === value}
              <Check size={15} class="check" />
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .transport-select {
    position: relative;
  }

  .trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    cursor: pointer;
    text-align: left;
  }

  .trigger.open,
  .trigger:focus-visible {
    border-color: rgba(58, 132, 145, 0.42);
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 0 0 3px rgba(58, 132, 145, 0.12);
  }

  .trigger-content {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .trigger-label {
    color: #1d2d38;
    font-size: 14px;
    font-weight: 700;
  }

  .trigger :global(.chevron) {
    flex: 0 0 auto;
    color: #6a7f85;
    transition: transform 180ms ease;
  }

  .trigger :global(.chevron.open) {
    transform: rotate(180deg);
    color: #2d7c89;
  }

  .menu {
    position: absolute;
    z-index: 8;
    top: calc(100% + 6px);
    right: 0;
    left: 0;
    margin: 0;
    padding: 6px;
    list-style: none;
    border: 1px solid rgba(31, 54, 63, 0.14);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 18px 40px rgba(24, 44, 51, 0.16);
    backdrop-filter: blur(12px);
  }

  .option {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    border: none;
    border-radius: 8px;
    background: transparent;
    padding: 9px 10px;
    text-align: left;
    cursor: pointer;
    transition: background 140ms ease;
  }

  .option.active {
    background: rgba(45, 124, 137, 0.1);
  }

  .option.selected {
    background: rgba(45, 124, 137, 0.14);
  }

  .option-icon {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(45, 124, 137, 0.1);
    color: #2d7c89;
  }

  .option-label {
    flex: 1;
    color: #172832;
    font-size: 14px;
    font-weight: 700;
  }

  .option :global(.check) {
    flex: 0 0 auto;
    color: #2d7c89;
  }
</style>
