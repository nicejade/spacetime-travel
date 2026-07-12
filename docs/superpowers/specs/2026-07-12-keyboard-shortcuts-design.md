# 键盘快捷键 — 设计文档

> 对应 backlog：P5-5。
> 目标文件：`client/lib/shortcuts.ts`（新增）、`client/lib/shortcuts.test.ts`、`client/App.svelte`、`client/components/TravelCanvas.svelte`。

## 背景

地图交互目前依赖鼠标/触控控件；电影模式已在 `App.onMount` 监听 Space（暂停）与 Esc（退出）。HANDOFF 要求补齐日常快捷键，并与电影模式键位统一、避免在输入框或模态中误触。

## 目标

1. 地图模式下支持缩放 / 复位 / 切站 / 新建快捷键。
2. 电影模式仅保留 Space / Esc；不响应地图快捷键。
3. 焦点在可编辑控件、或 VisitForm / Confirm / Poster 打开时，不触发地图快捷键。
4. 键位解析抽成纯函数，可单测。

## 非目标

- 快捷键帮助面板 / 可配置键位。
- 统计页专用快捷键。
- 电影模式内方向键切站。
- 本会话不做 P4-1 runes。

## 关键设计决策

| 决策 | 选择 |
| --- | --- |
| 实现方式 | 方案 2：`shortcuts.ts` 纯函数路由 + App / TravelCanvas 薄接线 |
| 地图键位 | `+`/`=` 放大；`-` 缩小；`0` 复位；`←`/`→` 切站；`N` 新建 |
| 电影键位 | Space 暂停/继续；Esc 退出（保持现状） |
| 抑制 | 可编辑焦点 **或** 模态打开（VisitForm / Confirm / Poster） |
| 切站范围 | 当前年份筛选下的 `visibleVisits`（按现有列表顺序，即日期序） |
| `0` 复位 | 恢复 TravelCanvas 初始 `scale`（0.52）与居中式 pan（与控件「复位」一致，若已有按钮则复用同一函数） |

## 架构

### 模块

```
client/lib/shortcuts.ts
  isTypingTarget(target: EventTarget | null): boolean
  resolveShortcut(event, context) → ShortcutAction | null

client/lib/shortcuts.test.ts
client/App.svelte          — window keydown；执行 select / N / movie；调用 canvas 缩放
client/components/TravelCanvas.svelte — 暴露 zoomIn / zoomOut / resetView（供 App 调用或 bind:this）
```

### `ShortcutAction`

```ts
type ShortcutAction =
  | { type: 'zoom-in' }
  | { type: 'zoom-out' }
  | { type: 'zoom-reset' }
  | { type: 'prev-visit' }
  | { type: 'next-visit' }
  | { type: 'create-visit' }
  | { type: 'movie-toggle-pause' }
  | { type: 'movie-stop' };
```

### `resolveShortcut` 上下文

```ts
{
  movieActive: boolean;
  movieExporting: boolean;
  modalOpen: boolean; // editorOpen || confirmOpen || posterOpen
  typing: boolean;    // isTypingTarget(event.target) — 也可在调用前算好传入
}
```

解析规则（优先级）：

1. `typing === true` → `null`（电影 Space/Esc 也不抢输入框）。
2. `movieExporting` → `null`。
3. `movieActive` → 仅 Space / Esc；其它键 `null`。
4. `modalOpen` → `null`。
5. 地图键：`+`/`=`/`Add` → zoom-in；`-`/`Subtract` → zoom-out；`0` → zoom-reset；`ArrowLeft` → prev；`ArrowRight` → next；`n`/`N` → create（忽略带 Meta/Ctrl/Alt 的组合键）。

### 接线

- **App**：合并现有 movie listener 为统一 `handleKeydown`；`modalOpen = editorOpen || $poster.open || confirmIsOpen`（Confirm 若无全局 flag，用 `confirm.ts` 暴露 `isConfirmOpen()` 或等价只读状态）。
- **切站**：在 `visibleVisits` 中找当前 `selectedVisitId` 下标，±1 并 `selectVisit`；无选中时 `→` 选第一个、`←` 选最后一个。
- **缩放**：`bind:this={travelCanvas}` 或 callback props；调用与控件按钮相同的 `zoomAt(1.16)` / `zoomAt(0.86)` / reset。
- **统计页**：`activeView === 'stats'` 时不处理地图缩放/切站（可视为 `modalOpen` 同类的 `blocked`，或单独 `mapInteractive`）；`N` 是否可用：本项 **统计页禁用全部地图快捷键**（简洁）。

### Confirm 打开检测

`confirmStore` 已有 `open` 字段；`modalOpen` 使用 `get(confirmStore).open`（或模板里 `$confirmStore.open`）即可，无需新 API。

## 测试计划

1. `isTypingTarget`：input/textarea/select/contenteditable → true；div → false。
2. `resolveShortcut`：地图各键；电影 Space/Esc；typing / modal / exporting / stats-blocked → null；Meta+N → null。
3. 切站辅助（若抽出 `adjacentVisitId(visits, currentId, delta)`）：边界环绕或夹紧——**本项采用夹紧不环绕**（已在首尾则保持）。
4. 手测：地图 `+/-/0/←/→/N`；打开表单后按键无效；电影 Space/Esc；输入框内打字不触发。

## 验收标准

- [ ] `pnpm typecheck` + `pnpm test` 通过
- [ ] 地图快捷键与控件行为一致
- [ ] 电影 / 模态 / 输入焦点不误触
- [ ] HANDOFF P5-5 标为完成

## 实现备注

- 不引入快捷键 UI 提示条（非目标）；控件按钮 `title` 可顺手补上键名（可选、非必须）。
- Space 在地图模式本项不绑定（避免与滚动/按钮默认行为纠缠）；仅电影模式使用。
