<script lang="ts">
  import { Save, X } from '@lucide/svelte';
  import LocationPicker from './LocationPicker.svelte';
  import TagInput from './TagInput.svelte';
  import TransportSelect from './TransportSelect.svelte';
  import { createVisit, updateVisit } from '$lib/api';
  import { focusTrap } from '$lib/focusTrap';
  import type { Location, Transport, Visit, VisitMutationResult, VisitPayload } from '$lib/types';

  export let mode: 'create' | 'edit' = 'create';
  export let visit: Visit | null = null;
  export let originSuggestions: Location[] = [];
  export let showInboundFields = false;
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
        originName: visit.origin.name,
        originCountry: visit.origin.country,
        originLat: visit.origin.lat,
        originLng: visit.origin.lng,
        returnsToOrigin: visit.returnsToOrigin,
        outboundTransport: visit.outboundTransport,
        outboundNote: visit.outboundNote,
        returnTransport: visit.returnTransport || '',
        returnNote: visit.returnNote,
        inboundTransport: visit.inboundTransport || 'flight',
        inboundNote: visit.inboundNote || '',
        arrivedAt: visit.arrivedAt,
        departedAt: visit.departedAt || '',
        feeling: visit.feeling || '',
        food: visit.food || '',
        rating: visit.rating || 4.5,
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
      originName: '',
      originCountry: '',
      originLat: '',
      originLng: '',
      returnsToOrigin: true,
      outboundTransport: 'flight',
      outboundNote: '',
      returnTransport: '',
      returnNote: '',
      inboundTransport: 'flight',
      inboundNote: '',
      arrivedAt: new Date().toISOString().slice(0, 10),
      departedAt: '',
      feeling: '',
      food: '',
      rating: 4.5,
      mood: '',
      weather: '',
      memory: '',
      tags: ''
    };
  }

  const TRANSPORT_SET = new Set(['flight', 'train', 'ferry', 'drive', 'bus', 'walk']);
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  function isValidIsoDate(value: string): boolean {
    if (!ISO_DATE.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }

  function validateBeforeSubmit(): string | null {
    if (!isValidIsoDate(String(values.arrivedAt || ''))) {
      return '到达时间格式无效，请使用 YYYY-MM-DD';
    }
    const departed = String(values.departedAt || '').trim();
    if (departed) {
      if (!isValidIsoDate(departed)) {
        return '离开时间格式无效，请使用 YYYY-MM-DD';
      }
      if (departed < String(values.arrivedAt)) {
        return '离开时间不能早于到达时间';
      }
    }
    const outbound = String(values.outboundTransport || '').trim();
    if (outbound && !TRANSPORT_SET.has(outbound)) {
      return '去程交通方式无效';
    }
    const inbound = String(values.inboundTransport || '').trim();
    if (inbound && !TRANSPORT_SET.has(inbound)) {
      return '站间交通方式无效';
    }
    const ret = String(values.returnTransport || '').trim();
    if (ret && !TRANSPORT_SET.has(ret)) {
      return '返程交通方式无效';
    }
    return null;
  }

  async function submit() {
    if (Number(values.lat) === Number(values.originLat) && Number(values.lng) === Number(values.originLng)) {
      error = '起点与目的地不能相同';
      return;
    }

    const validationError = validateBeforeSubmit();
    if (validationError) {
      error = validationError;
      return;
    }

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
    if (place.name) values.locationName = place.name;
    if (place.country) values.country = place.country;
    values.lat = place.lat;
    values.lng = place.lng;
    values = values;
  }

  function handleOriginPick(place: { name?: string; country?: string; lat: number; lng: number }) {
    if (place.name) values.originName = place.name;
    if (place.country) values.originCountry = place.country;
    values.originLat = place.lat;
    values.originLng = place.lng;
    values = values;
  }

  function fillOrigin(suggestion: Location) {
    values.originName = suggestion.name;
    values.originCountry = suggestion.country;
    values.originLat = suggestion.lat;
    values.originLng = suggestion.lng;
    values = values;
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }
</script>

<div class="form-backdrop" role="presentation" on:click={handleBackdropClick}>
  <form
    class="visit-form glass-panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby="visit-form-title"
    tabindex="-1"
    use:focusTrap={{ onEscape: onClose }}
    on:submit|preventDefault={submit}
  >
    <div class="form-head">
      <div>
        <p>{mode === 'edit' ? '编辑节点' : '新增节点'}</p>
        <h2 id="visit-form-title">{mode === 'edit' ? visit?.location.name : '旅行时空记录'}</h2>
      </div>
      <button type="button" class="icon-button" aria-label="关闭" title="关闭" on:click={onClose}>
        <X size={18} />
      </button>
    </div>

    {#if originSuggestions.length}
      <div class="origin-chips">
        <span class="picker-label">常用起点</span>
        <div class="chip-row">
          {#each originSuggestions as suggestion (suggestion.id)}
            <button type="button" class="chip" on:click={() => fillOrigin(suggestion)}>
              {suggestion.name}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="section-label">出发</div>

    <div class="picker-block">
      <span class="picker-label">起点</span>
      <LocationPicker
        name={values.originName}
        country={values.originCountry}
        lat={values.originLat}
        lng={values.originLng}
        onPick={handleOriginPick}
      />
    </div>

    <div class="field-row">
      <label>
        <span>起点名称</span>
        <input class="field" required name="originName" bind:value={values.originName} placeholder="杭州" />
      </label>
      <label>
        <span>起点国家/地区</span>
        <input class="field" required name="originCountry" bind:value={values.originCountry} placeholder="中国" />
      </label>
    </div>

    <details class="coord-details">
      <summary>手动微调起点坐标</summary>
      <div class="field-row coord-row">
        <label>
          <span>纬度</span>
          <input class="field" required type="number" min="-90" max="90" step="0.0001" bind:value={values.originLat} />
        </label>
        <label>
          <span>经度</span>
          <input class="field" required type="number" min="-180" max="180" step="0.0001" bind:value={values.originLng} />
        </label>
      </div>
    </details>

    <div class="field-row">
      <label>
        <span>去程方式</span>
        <TransportSelect bind:value={values.outboundTransport as Transport} />
      </label>
      <label>
        <span>去程备注</span>
        <input class="field" bind:value={values.outboundNote} placeholder="从家出发的路上" />
      </label>
    </div>

    <div class="section-label">目的地</div>

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

    {#if showInboundFields}
      <div class="field-row">
        <label>
          <span>站间移动</span>
          <TransportSelect bind:value={values.inboundTransport as Transport} />
        </label>
        <label>
          <span>站间备注</span>
          <input class="field" bind:value={values.inboundNote} placeholder="上一站目的地到这里的路上" />
        </label>
      </div>
    {/if}

    <div class="field-row">
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
      <span>标签</span>
      {#key key}
        <TagInput bind:value={values.tags} placeholder="输入后按逗号或回车键生成标签" />
      {/key}
    </label>

    <div class="section-label">返回</div>

    <label class="checkbox-row">
      <input type="checkbox" bind:checked={values.returnsToOrigin} />
      <span>返回起点</span>
    </label>

    {#if values.returnsToOrigin}
      <details class="return-details">
        <summary>返程方式（默认同去程）</summary>
        <div class="field-row">
          <label>
            <span>返程方式</span>
            <TransportSelect bind:value={values.returnTransport as Transport} />
          </label>
          <label>
            <span>返程备注</span>
            <input class="field" bind:value={values.returnNote} placeholder="回程路上的记忆" />
          </label>
        </div>
      </details>
    {/if}

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
    outline: none;
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

  .section-label {
    margin-top: 4px;
    color: #2d7c89;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
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

  .origin-chips {
    display: grid;
    gap: 8px;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    border: 1px solid rgba(45, 124, 137, 0.22);
    border-radius: 999px;
    background: rgba(45, 124, 137, 0.08);
    color: #2d7c89;
    cursor: pointer;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 700;
    transition: background 140ms ease, border-color 140ms ease;
  }

  .chip:hover {
    border-color: rgba(45, 124, 137, 0.42);
    background: rgba(45, 124, 137, 0.14);
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
  }

  .checkbox-row input {
    width: 16px;
    height: 16px;
    accent-color: #2d7c89;
  }

  .checkbox-row span {
    color: #304751;
    font-size: 14px;
    font-weight: 700;
  }

  .return-details {
    border: 1px solid rgba(31, 54, 63, 0.11);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.5);
    padding: 4px 12px;
  }

  .return-details summary {
    padding: 8px 0;
    color: #304751;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    list-style: none;
  }

  .return-details summary::-webkit-details-marker {
    display: none;
  }

  .return-details summary::before {
    content: '▸';
    margin-right: 6px;
    color: #6a7f85;
  }

  .return-details[open] summary::before {
    content: '▾';
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
