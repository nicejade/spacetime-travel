<script lang="ts">
  import { X } from '@lucide/svelte';
  import { splitTags } from '$lib/format';

  export let value = '';
  export let placeholder = '';

  let draft = '';
  let tags: string[] = [];

  $: tags = splitTags(value);

  function syncValue(nextTags: string[]) {
    value = nextTags.join(',');
  }

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || tags.includes(tag)) return;
    syncValue([...tags, tag]);
  }

  function removeTag(index: number) {
    syncValue(tags.filter((_, i) => i !== index));
  }

  function commitDraft() {
    if (!draft.trim()) return;
    addTag(draft);
    draft = '';
  }

  function handleInput(event: Event) {
    const text = (event.currentTarget as HTMLInputElement).value;
    if (!text.includes(',') && !text.includes('，')) {
      draft = text;
      return;
    }

    const parts = text.split(/[,，]/);
    parts.slice(0, -1).forEach(addTag);
    draft = parts[parts.length - 1] ?? '';
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === ',' || event.key === '，') {
      event.preventDefault();
      commitDraft();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      commitDraft();
      return;
    }

    if (event.key === 'Backspace' && !draft && tags.length) {
      removeTag(tags.length - 1);
    }
  }

  function handleBlur() {
    commitDraft();
  }

  function handlePaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text') ?? '';
    if (!text.includes(',') && !text.includes('，')) return;

    event.preventDefault();
    const parts = text.split(/[,，]/);
    parts.slice(0, -1).forEach(addTag);
    draft = (draft + (parts[parts.length - 1] ?? '')).trimStart();
  }
</script>

<div class="tag-input field">
  {#each tags as tag, index}
    <span class="tag-chip">
      {tag}
      <button type="button" class="tag-remove" aria-label={`移除标签 ${tag}`} on:click={() => removeTag(index)}>
        <X size={12} />
      </button>
    </span>
  {/each}
  <input
    class="tag-field"
    type="text"
    value={draft}
    {placeholder}
    on:input={handleInput}
    on:keydown={handleKeydown}
    on:blur={handleBlur}
    on:paste={handlePaste}
  />
</div>

<style>
  .tag-input {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-height: 42px;
    padding: 6px 10px;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid rgba(45, 124, 137, 0.22);
    border-radius: 999px;
    background: rgba(45, 124, 137, 0.1);
    color: #2a4d57;
    padding: 4px 6px 4px 9px;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.2;
  }

  .tag-remove {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: #5d747c;
    padding: 0;
    cursor: pointer;
  }

  .tag-remove:hover {
    background: rgba(31, 54, 63, 0.1);
    color: #2d4a54;
  }

  .tag-field {
    flex: 1 1 120px;
    min-width: 80px;
    border: none;
    background: transparent;
    color: #172832;
    padding: 4px 2px;
    font: inherit;
    outline: none;
  }

  .tag-field::placeholder {
    color: #8a9da3;
  }
</style>
