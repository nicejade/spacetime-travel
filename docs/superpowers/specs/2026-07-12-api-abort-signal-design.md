# API AbortSignal 竞态防护 — 设计文档

> 对应 backlog：P4-5（API 客户端增强）。
> 目标文件：`client/lib/api.ts`、`client/App.svelte`（`loadAtlas`）、`client/components/VisitForm.svelte`、相关单测。

## 背景

`client/lib/api.ts` 的 CRUD / atlas fetch 未接入 `AbortSignal`。电影导出已有 `AbortController`，但日常路径没有：

- 连续点「刷新 / 重试」时，较慢的旧 `fetchAtlas` 可能在较新请求之后返回，用旧 atlas 覆盖新状态。
- VisitForm 保存进行中关闭模态时，迟到的 `createVisit` / `updateVisit` 仍会触发 `onSaved`，造成选中态与 notice 错乱。

年份筛选本身是本地过滤，不发起网络请求；本项竞态面是 **atlas 加载** 与 **表单保存**。

## 目标

1. API 层为相关 fetch 提供可选 `signal?: AbortSignal`。
2. `loadAtlas`：新请求自动 abort 旧请求；仅最新请求可写 `atlas` / `error` / `loading`。
3. VisitForm：关闭 / 销毁时 abort 进行中的保存；abort 后不调用 `onSaved`。
4. Abort 视为预期取消：**静默忽略**（不写 error / notice）。
5. 可测：`isAbortError`（及必要的 signal 传递）有单测。

## 非目标（YAGNI）

- 自动 retry。
- `deleteVisit` / undo `createVisit` / import / export 接 abort。
- 服务端幂等 token（abort 只取消客户端等待；请求已达服务端时写入仍可能完成——可接受）。
- Svelte 5 runes 迁移（P4-1）。
- 年份切换触发网络请求。

## 关键设计决策

| 决策 | 选择 |
| --- | --- |
| 实现方式 | AbortController + 可选 `signal`（方案 2；非 generation-only、非中央 RequestManager） |
| Abort UI | 静默忽略 |
| 范围 | 仅 `fetchAtlas` + `createVisit` / `updateVisit` 增加可选 `signal` 并接线；`deleteVisit` / import / export 本项不改 |
| loading 语义 | 仅当「本请求仍是当前 in-flight」时在 finally 清 `loading`；被取代的旧请求不把 loading 打回 false |

## 架构

### 模块划分

```
client/lib/api.ts              — signal 透传 + isAbortError
client/App.svelte              — loadAtlas 持有 AbortController
client/components/VisitForm.svelte — submit AbortController；close/destroy abort
client/lib/api.test.ts         — isAbortError +（可选）signal 传入 fetch
```

### API 层

- `fetchAtlas(options?: { signal?: AbortSignal })`
- `createVisit(payload, options?: { signal?: AbortSignal })`
- `updateVisit(id, payload, options?: { signal?: AbortSignal })`
- 内部 `fetch(url, { ..., signal: options?.signal })`
- `export function isAbortError(error: unknown): boolean`  
  — 识别 `AbortError`（`DOMException` / `Error.name === 'AbortError'`）

签名保持向后兼容：现有无 options 调用不变。

### `loadAtlas`

```
let atlasController: AbortController | null = null

async function loadAtlas() {
  atlasController?.abort()
  const controller = new AbortController()
  atlasController = controller
  loading = true
  error = ''
  try {
    atlas = await fetchAtlas({ signal: controller.signal })
    // 选中 visit 逻辑保持现状
  } catch (e) {
    if (isAbortError(e) || controller.signal.aborted) return
    error = ...
  } finally {
    if (atlasController === controller) {
      loading = false
      atlasController = null
    }
  }
}
```

### VisitForm

- 字段：`let saveController: AbortController | null = null`
- `submit`：新建 controller，传入 create/update；成功则 `onSaved`
- catch：若 `isAbortError` → 静默（可清 `busy`，不设 `error`）
- `onClose` / backdrop / `onDestroy`：`saveController?.abort()`
- abort 后不调用 `onSaved`

### 错误处理矩阵

| 场景 | UI |
| --- | --- |
| atlas abort（被新请求取代） | 无 error；由新请求接管 loading |
| 保存 abort（关表单） | 无 error / notice；不 onSaved |
| 真实网络 / 4xx / 5xx | 现有 error 路径不变 |

## 测试计划

1. `isAbortError`：AbortError → true；普通 Error → false。
2. （可选）mock `globalThis.fetch`：传入 signal 后 abort，断言 reject 且调用方静默路径可测则测。
3. 手测：慢网（DevTools throttle）下连续点刷新；保存中 Esc/点遮罩关闭——无错乱覆盖、无假错误。

## 验收标准

- [ ] `pnpm typecheck` 通过
- [ ] `pnpm test` 通过（含新增 abort 相关单测）
- [ ] 慢网连续刷新：最终 atlas 与最新响应一致，无旧数据回闪
- [ ] 保存中关闭表单：无「旅行节点已保存」、无保存失败红字
- [ ] HANDOFF P4-5 标为完成

## 实现备注

- 与电影导出的 AbortController 模式对齐，但不抽共享 RequestManager。
- 本项不修改服务端。
