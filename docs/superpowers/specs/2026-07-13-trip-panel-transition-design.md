# 详情面板切换过渡 — 设计文档

> 对应 backlog：P5-10。
> 目标文件：`client/components/TripPanel.svelte`（及必要时极少量 scoped CSS）。

## 背景

选中节点切换时，`TripPanel` 内容瞬时替换，缺少「飞到下一站」的连续感。地图侧已有选中/路段高亮；详情面板仍是硬切。

## 目标

1. **visit → visit** 切换时：内容淡入 + 轻微上移（约 220ms）。
2. 尊重 `prefers-reduced-motion`（沿用 `app.css` 全局缩短，或组件内直接跳过动画）。
3. 不改变信息架构与操作按钮行为。

## 非目标

- empty ↔ visit 动画（瞬时即可）。
- 按切站方向左右滑页（方案 B）。
- 标题/年份 chip 闪烁强调。
- 与地图镜头 / focusVisit 联动的额外动画。
- 双缓冲 crossfade（方案 2）；View Transitions API（方案 3）。
- Svelte 5 runes（P4-1）。

## 关键设计决策

| 决策 | 选择 |
| --- | --- |
| 实现方式 | 方案 1：`{#key visit.id}` + CSS 入场 keyframes |
| 时长 / 缓动 | ~220ms，ease（或 ease-out） |
| 位移 | `translateY(8px → 0)` + `opacity 0 → 1` |
| 触发范围 | 仅 `visit` 存在且 `visit.id` 变化 |
| reduced-motion | 无动画或瞬时完成 |

## 架构

```
TripPanel.svelte
  {#if visit && year !== null}
    {#key visit.id}
      <div class="panel-body panel-body--enter">
        …现有详情内容…
      </div>
    {/key}
  {:else}
    …empty 不变…
  {/if}
```

- `{#key visit.id}` 迫使换站时 remount，从而重播入场动画。
- 不新增共享 lib（无复杂时序）；若日后要 crossfade 再抽。

## 测试计划

- 手测：时间轴 / 地图 / `←``→` 切站，面板淡入上移；空态出现无动画。
- `prefers-reduced-motion: reduce` 下无位移闪烁。
- `pnpm typecheck`（无新纯函数则可不加单测）。

## 验收标准

- [ ] visit→visit 有约 220ms 淡入上移
- [ ] empty↔visit 无强制动画
- [ ] reduced-motion 下可接受（无大幅位移）
- [ ] HANDOFF P5-10 标为完成

## 实现备注

- 保持现有 glass-panel / 布局尺寸，避免动画引起 CLS（只动 opacity/transform）。
- 可选：给控件按钮补 title——非本项必须。
