<script lang="ts">
  import { Download, Share2, X } from '@lucide/svelte';
  import { downloadBlob } from '$lib/movie/engine';
  import { onDestroy } from 'svelte';

  export let open = false;
  export let generating = false;
  export let blob: Blob | null = null;
  export let filename = 'spacetime-travel.png';
  export let error = '';
  export let onClose: () => void = () => {};

  let previewUrl = '';
  let canShare = false;

  $: if (blob) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(blob);
    const file = new File([blob], filename, { type: 'image/png' });
    canShare = Boolean(navigator.canShare?.({ files: [file] }));
  } else if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    canShare = false;
  }

  onDestroy(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  });

  function handleBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget && !generating) onClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !generating) onClose();
  }

  function saveImage() {
    if (!blob) return;
    downloadBlob(blob, filename);
  }

  async function shareImage() {
    if (!blob) return;
    const file = new File([blob], filename, { type: 'image/png' });
    if (!navigator.canShare?.({ files: [file] })) return;
    await navigator.share({ files: [file], title: filename });
  }
</script>

<svelte:window on:keydown={open ? handleKeydown : undefined} />

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
  <div
    class="poster-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="旅行海报预览"
    tabindex="-1"
    on:click={handleBackdrop}
  >
    <div class="poster-shell">
      <button type="button" class="close-button" aria-label="关闭" disabled={generating} on:click={onClose}>
        <X size={18} />
      </button>

      {#if generating}
        <div class="poster-state">
          <div class="spinner" aria-hidden="true"></div>
          <p>正在生成海报…</p>
        </div>
      {:else if error}
        <div class="poster-state">
          <p class="error">{error}</p>
          <button type="button" class="secondary-button" on:click={onClose}>关闭</button>
        </div>
      {:else if previewUrl}
        <img class="poster-preview" src={previewUrl} alt="{filename} 预览" width="1080" height="1440" />
        <div class="poster-actions glass-panel">
          <button type="button" class="primary-button" on:click={saveImage}>
            <Download size={17} />保存图片
          </button>
          {#if canShare}
            <button type="button" class="secondary-button" on:click={shareImage}>
              <Share2 size={17} />分享
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .poster-overlay {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(25, 47, 65, 0.45);
    backdrop-filter: blur(8px);
  }

  .poster-shell {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    width: min(100%, 420px);
  }

  .close-button {
    position: absolute;
    top: -8px;
    right: -8px;
    z-index: 2;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 1px solid rgba(31, 54, 63, 0.13);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.92);
    color: #203340;
  }

  .close-button:disabled {
    opacity: 0.5;
  }

  .poster-preview {
    width: 100%;
    aspect-ratio: 4 / 5;
    border-radius: 12px;
    box-shadow: 0 24px 70px rgba(25, 47, 65, 0.22);
    object-fit: contain;
    background: #fff;
  }

  .poster-actions {
    display: flex;
    gap: 10px;
    width: 100%;
    padding: 14px;
    border-radius: 12px;
  }

  .poster-actions :global(.primary-button),
  .poster-actions :global(.secondary-button) {
    flex: 1;
    justify-content: center;
  }

  .poster-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    min-height: 280px;
    justify-content: center;
    padding: 32px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 24px 70px rgba(25, 47, 65, 0.16);
    width: 100%;
  }

  .poster-state p {
    margin: 0;
    color: #2d4650;
    font-size: 15px;
  }

  .poster-state .error {
    color: #b42318;
    text-align: center;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(35, 95, 115, 0.16);
    border-top-color: #235f73;
    border-radius: 999px;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
