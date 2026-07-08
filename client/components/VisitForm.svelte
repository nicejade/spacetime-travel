<script lang="ts">
  import { Save, X } from '@lucide/svelte';
  import LocationPicker from './LocationPicker.svelte';
  import { createVisit, updateVisit } from '$lib/api';
  import { transports } from '$lib/format';
  import type { Visit, VisitMutationResult, VisitPayload } from '$lib/types';

  export let mode: 'create' | 'edit' = 'create';
  export let visit: Visit | null = null;
  export let onClose: () => void = () => {};
  export let onSaved: (result: VisitMutationResult) => void = () => {};

  let busy = false;
  let error = '';
  let lastKey = '';
  let values: VisitPayload = buildValues();

  $: key = `${mode}:${visit?.id ?? 'new'}`;
  $: if (key !== lastKey) {
    values = buildValues();
    error = '';
    lastKey = key;
  }

  function buildValues(): VisitPayload {
    if (mode === 'edit' && visit) {
      return {
        locationName: visit.location.name,
        country: visit.location.country,
        lat: visit.location.lat,
        lng: visit.location.lng,
        arrivedAt: visit.arrivedAt,
        departedAt: visit.departedAt || '',
        transport: visit.transport || 'flight',
        legNote: visit.legNote || '',
        feeling: visit.feeling || '',
        food: visit.food || '',
        rating: visit.rating || 4,
        mood: visit.mood || '',
        weather: visit.weather || '',
        memory: visit.memory || '',
        tags: visit.tags || ''
      };
    }

    return {
      locationName: '',
      country: '',
      lat: '',
      lng: '',
      arrivedAt: new Date().toISOString().slice(0, 10),
      departedAt: '',
      transport: 'flight',
      legNote: '',
      feeling: '',
      food: '',
      rating: 4.5,
      mood: '',
      weather: '',
      memory: '',
      tags: ''
    };
  }

  async function submit() {
    busy = true;
    error = '';

    try {
      const payload = { ...values };
      const result = mode === 'edit' && visit ? await updateVisit(visit.id, payload) : await createVisit(payload);
      onSaved(result);
    } catch (submitError) {
      error = submitError instanceof Error ? submitError.message : '保存失败';
    } finally {
      busy = false;
    }
  }

  function handlePick(place: { name?: string; country?: string; lat: number; lng: number }) {
    // Search hits also carry a name; map clicks only carry country + coordinates,
    // so we never overwrite a name the user already typed.
    if (place.name) values.locationName = place.name;
    if (place.country) values.country = place.country;
    values.lat = place.lat;
    values.lng = place.lng;
    values = values;
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }
</script>

<div class="form-backdrop" role="presentation" on:click={handleBackdropClick}>
  <form class="visit-form glass-panel" aria-label="旅行节点表单" on:submit|preventDefault={submit}>
    <div class="form-head">
      <div>
        <p>{mode === 'edit' ? '编辑节点' : '新增节点'}</p>
        <h2>{mode === 'edit' ? visit?.location.name : '旅行时空记录'}</h2>
      </div>
      <button type="button" class="icon-button" aria-label="关闭" title="关闭" on:click={onClose}>
        <X size={18} />
      </button>
    </div>

    <div class="picker-block">
      <span class="picker-label">选择地点</span>
      <LocationPicker
        name={values.locationName}
        country={values.country}
        lat={values.lat}
        lng={values.lng}
        onPick={handlePick}
      />
    </div>

    <div class="field-row">
      <label>
        <span>地点</span>
        <input class="field" required name="locationName" bind:value={values.locationName} placeholder="京都" />
      </label>
      <label>
        <span>国家/地区</span>
        <input class="field" required name="country" bind:value={values.country} placeholder="日本" />
      </label>
    </div>

    <details class="coord-details">
      <summary>手动微调坐标</summary>
      <div class="field-row coord-row">
        <label>
          <span>纬度</span>
          <input class="field" required type="number" min="-90" max="90" step="0.0001" bind:value={values.lat} />
        </label>
        <label>
          <span>经度</span>
          <input class="field" required type="number" min="-180" max="180" step="0.0001" bind:value={values.lng} />
        </label>
      </div>
    </details>

    <div class="field-row">
      <label>
        <span>到达时间</span>
        <input class="field" required type="date" bind:value={values.arrivedAt} />
      </label>
      <label>
        <span>离开时间</span>
        <input class="field" type="date" bind:value={values.departedAt} />
      </label>
    </div>

    <div class="field-row">
      <label>
        <span>前往方式</span>
        <select class="select-field" bind:value={values.transport}>
          {#each transports as transport}
            <option value={transport.value}>{transport.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>评分：{Number(values.rating).toFixed(1)}</span>
        <input class="field" type="range" min="1" max="5" step="0.1" bind:value={values.rating} />
      </label>
    </div>

    <label>
      <span>个人感受</span>
      <textarea class="text-field" bind:value={values.feeling} placeholder="这段旅行留给你的气味、声音和心情"></textarea>
    </label>

    <label>
      <span>饮食</span>
      <input class="field" bind:value={values.food} placeholder="蛋挞、海鲜饭、清晨咖啡" />
    </label>

    <div class="field-row">
      <label>
        <span>心境</span>
        <input class="field" bind:value={values.mood} placeholder="松弛" />
      </label>
      <label>
        <span>天气</span>
        <input class="field" bind:value={values.weather} placeholder="晴有风" />
      </label>
    </div>

    <label>
      <span>记忆片段</span>
      <input class="field" bind:value={values.memory} placeholder="黄昏、河岸、没读完的书" />
    </label>

    <label>
      <span>移动备注</span>
      <input class="field" bind:value={values.legNote} placeholder="从上一站到这里的路上发生了什么" />
    </label>

    <label>
      <span>标签</span>
      <input class="field" bind:value={values.tags} placeholder="海边,美食,独旅" />
    </label>

    {#if error}
      <p class="form-error">{error}</p>
    {/if}

    <div class="form-actions">
      <button type="button" class="secondary-button" on:click={onClose}>取消</button>
      <button type="submit" class="primary-button" disabled={busy}>
        <Save size={17} />{busy ? '保存中' : '保存'}
      </button>
    </div>
  </form>
</div>

<style>
  .form-backdrop {
    position: fixed;
    z-index: 50;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(16, 31, 38, 0.26);
    padding: 20px;
  }

  .visit-form {
    display: grid;
    width: min(760px, 100%);
    max-height: min(860px, calc(100dvh - 40px));
    gap: 13px;
    overflow: auto;
    border-radius: 8px;
    padding: 18px;
  }

  .form-head,
  .form-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .form-head p {
    margin: 0 0 4px;
    color: #667a80;
    font-size: 12px;
    font-weight: 800;
  }

  h2 {
    margin: 0;
    color: #172832;
    font-size: 22px;
    line-height: 1.2;
  }

  label {
    display: grid;
    gap: 6px;
  }

  label span {
    color: #304751;
    font-size: 13px;
    font-weight: 800;
  }

  .field-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .picker-block {
    display: grid;
    gap: 6px;
  }

  .picker-label {
    color: #304751;
    font-size: 13px;
    font-weight: 800;
  }

  .coord-details {
    border: 1px solid rgba(31, 54, 63, 0.11);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.5);
    padding: 4px 12px;
  }

  .coord-details summary {
    padding: 8px 0;
    color: #304751;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    list-style: none;
  }

  .coord-details summary::-webkit-details-marker {
    display: none;
  }

  .coord-details summary::before {
    content: '▸';
    margin-right: 6px;
    color: #6a7f85;
  }

  .coord-details[open] summary::before {
    content: '▾';
  }

  .coord-row {
    padding-bottom: 10px;
  }

  input[type='range'] {
    accent-color: #2d7c89;
  }

  .form-error {
    margin: 0;
    border: 1px solid rgba(155, 53, 46, 0.18);
    border-radius: 8px;
    background: rgba(255, 247, 245, 0.9);
    color: #9b352e;
    padding: 10px 12px;
    font-size: 13px;
  }

  .form-actions {
    position: sticky;
    bottom: -18px;
    margin: 4px -18px -18px;
    border-top: 1px solid rgba(31, 54, 63, 0.1);
    background: rgba(255, 255, 255, 0.82);
    padding: 12px 18px;
    backdrop-filter: blur(16px);
  }

  .form-actions button {
    min-width: 124px;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.66;
  }

  @media (max-width: 720px) {
    .form-backdrop {
      align-items: end;
      padding: 12px;
    }

    .visit-form {
      max-height: calc(100dvh - 24px);
    }

    .field-row {
      grid-template-columns: 1fr;
    }

    .form-actions {
      gap: 8px;
    }

    .form-actions button {
      flex: 1;
      min-width: 0;
    }
  }
</style>
