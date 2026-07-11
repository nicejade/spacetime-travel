<script lang="ts">
  import { confirmStore } from '$lib/confirm';
  import { focusTrap } from '$lib/focusTrap';

  $: open = $confirmStore.open;
  $: options = $confirmStore.options;
  $: title = options?.title ?? '请确认';
  $: message = options?.message ?? '';
  $: confirmLabel = options?.confirmLabel ?? '确定';
  $: cancelLabel = options?.cancelLabel ?? '取消';
  $: variant = options?.variant ?? 'default';

  function close(result: boolean) {
    confirmStore.settle(result);
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close(false);
    }
  }
</script>

{#if open && options}
  <div
    class="confirm-backdrop"
    role="presentation"
    on:click={handleBackdropClick}
  >
    <div
      class="confirm-dialog glass-panel"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      tabindex="-1"
      use:focusTrap={{ onEscape: () => close(false) }}
    >
      <p id="confirm-title" class="confirm-title">{title}</p>
      <p id="confirm-message" class="confirm-message">{message}</p>

      <div class="confirm-actions">
        <button type="button" class="secondary-button" on:click={() => close(false)}>
          {cancelLabel}
        </button>
        <button
          type="button"
          class={variant === 'danger' ? 'danger-button confirm-primary' : 'primary-button'}
          on:click={() => close(true)}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .confirm-backdrop {
    position: fixed;
    z-index: 60;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(16, 31, 38, 0.26);
    padding: 20px;
  }

  .confirm-dialog {
    width: min(400px, 100%);
    border-radius: 8px;
    padding: 20px;
    outline: none;
  }

  .confirm-title {
    margin: 0 0 10px;
    color: #667a80;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .confirm-message {
    margin: 0;
    color: #172832;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.55;
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }

  .confirm-primary {
    border-color: rgba(170, 62, 54, 0.42);
    background: linear-gradient(135deg, #9b352e, #c24a41);
    color: white;
    box-shadow: 0 12px 28px rgba(155, 53, 46, 0.24);
  }

  .confirm-primary:hover {
    border-color: rgba(170, 62, 54, 0.52);
    background: linear-gradient(135deg, #8a2f29, #b5443c);
  }

  @media (max-width: 480px) {
    .confirm-backdrop {
      align-items: end;
      padding: 12px;
    }

    .confirm-actions {
      flex-direction: column-reverse;
    }

    .confirm-actions :global(button) {
      width: 100%;
    }
  }
</style>
