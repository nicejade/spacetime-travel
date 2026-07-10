<script lang="ts">
  export let title = '';
  export let summary = '';
</script>

<section class="stat-card glass-panel">
  <header>
    <h3>{title}</h3>
    {#if summary}
      <p>{summary}</p>
    {/if}
  </header>
  <div class="body">
    <slot />
  </div>
</section>

<style>
  .stat-card {
    display: flex;
    min-height: 0;
    flex-direction: column;
    gap: 14px;
    border-radius: 8px;
    padding: 16px;
  }

  header h3 {
    margin: 0;
    color: #172832;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.01em;
  }

  header p {
    margin: 6px 0 0;
    color: #5f757d;
    font-size: 12px;
    line-height: 1.45;
  }

  .body {
    min-height: 0;
    flex: 1;
  }
</style>
