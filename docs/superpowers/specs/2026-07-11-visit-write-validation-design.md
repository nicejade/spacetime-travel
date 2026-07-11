# Visit 写入校验加固 — 设计文档

> 对应 backlog：P0-5（服务端写入校验）+ P3-5（前端表单校验对齐）。
> 目标文件：`server/visitValidation.ts`（新增）、`server/db.ts`、`server/index.ts`、`client/components/VisitForm.svelte`、`server/visitValidation.test.ts`（新增）。

## 背景

`createVisit` / `updateVisit` 经 `readVisitPayload` 解析请求体，但校验不完整：

- `arrivedAt` 只要求非空，无日期格式；`visitYear` 靠 `slice(0, 4)`。
- `departedAt` 与 `arrivedAt` 无先后关系校验（前后端皆无）。
- `outbound` / `return` / `inbound` transport 无枚举白名单。
- 路由 `:id`：`Number("abc")` → `NaN` → 落入 404，而非明确 400。
- 前端：无日期先后校验；create 评分默认 `4.5`、edit 缺省 `4` 不一致。

本地优先应用仍可能被手工 API 或脏表单写入坏数据，影响年份着色、排序与统计。

## 目标

1. **服务端硬校验**：非法日期、颠倒离站日、非法 transport、非数字 id → 明确 **400** + 中文错误信息。
2. **前端对称拦截**：提交前挡住明显非法组合，减少往返。
3. **默认值一致**：新建与编辑评分默认均为 `4.5`（编辑保留已有评分）。
4. **可测**：纯函数校验模块 + 单测覆盖非法/合法路径。

## 非目标（YAGNI）

- 引入 zod / Fastify JSON Schema / SQLite `CHECK`。
- 改变 `returnTransport` 可空语义（空则 fallback 去程，与 origin 设计一致）。
- 新建 `shared/` 包或前后端共享校验模块（留给 P1-6 / P1-7）。
- Schema 迁移或 DB 结构变更。
- 校验 mood / weather / tags 枚举。

## 关键设计决策

| 决策 | 选择 |
| --- | --- |
| 实现方式 | 手写纯函数模块 `server/visitValidation.ts`（方案 2） |
| 日期格式 | `YYYY-MM-DD`（与 `<input type="date">` 一致） |
| 离站日关系 | 可空；有值则 `departedAt >= arrivedAt`（允许同日） |
| `returnTransport` | 可空；有值则白名单；空不强制 |
| 评分默认 | 统一 `4.5`；服务端 `cleanRating` fallback 可随后改为 `4.5` 以一致 |
| `:id` 解析 | 正整数，否则 400（不再静默变 NaN→404） |
| Transport 白名单 | `flight \| train \| ferry \| drive \| bus \| walk` |

## 架构

### 模块划分

```
server/visitValidation.ts     — 纯函数：日期、transport、visitId
server/db.ts                  — readVisitPayload 调用校验
server/index.ts               — PUT/DELETE 先 parseVisitId
server/visitValidation.test.ts
client/components/VisitForm.svelte  — submit 前对称校验 + 默认评分
```

### 校验 API（服务端）

| 函数 | 行为 |
| --- | --- |
| `TRANSPORTS` / `isTransport` | 白名单常量与类型守卫 |
| `parseIsoDate(value, label)` | 非空且匹配 `YYYY-MM-DD`（含日历合法性）；否则 400 |
| `assertDateOrder(arrivedAt, departedAt)` | `departedAt` 非空且 `< arrivedAt` → 400 |
| `parseTransport(value, opts)` | 空 + required → 400 或 fallback；非空不在白名单 → 400 |
| `parseVisitId(raw)` | 匹配 `/^\d+$/` 且 `> 0`；否则 400 |

错误继续抛带 `status: 400` 的 `HttpError`，由现有 `setErrorHandler` 返回 `{ error: message }`。

### `readVisitPayload` 变更点

1. `arrivedAt = parseIsoDate(...)`
2. `departedAt`：空 → `null`；非空 → `parseIsoDate` + `assertDateOrder`
3. `outboundTransport = parseTransport(..., { fallback: 'flight' })`
4. `returnTransport`：`returnsToOrigin` 时，空 → `null`；非空 → 白名单
5. `inboundTransport`：空 → `null`；非空 → 白名单

坐标、起点≠目的地等现有校验保持不变。

### 路由 `:id`

```ts
const visitId = parseVisitId(request.params.id);
updateVisit(visitId, ...); // delete 同理
```

### 前端 `VisitForm`

- `submit()`：在发请求前校验日期格式、先后、有值 transport 白名单；失败设 `error` 文案，不发请求。
- `buildValues()`：create 与 edit 缺省评分均为 `4.5`；edit 有 `visit.rating` 时保留。
- **不**强制 `returnTransport` 必填。

## 错误文案（约定）

| 场景 | 示例文案 |
| --- | --- |
| 日期格式 | `到达时间格式无效，请使用 YYYY-MM-DD` |
| 先后关系 | `离开时间不能早于到达时间` |
| transport | `去程交通方式无效` / `返程交通方式无效` / `站间交通方式无效` |
| id | `访问 ID 无效` |

## 测试计划

`server/visitValidation.test.ts`：

- 非法日期（空、`2024-13-01`、`2024/01/01`、非字符串）→ 抛 400
- `departedAt < arrivedAt` → 400；同日与空 `departedAt` → 通过
- 非法 transport → 400；合法六种 + 空 return/inbound → 通过
- `parseVisitId("abc")` / `"0"` / `"-1"` → 400；`"42"` → `42`

手动：表单颠倒日期无法提交；合法保存仍成功。

## 验收标准

- 非法日期 / 颠倒离站日 / 非法 transport / 非数字 id → 明确 400
- 合法路径（含同日离站、空返程交通）回归通过
- 新建/编辑评分默认均为 `4.5`
- `node --import tsx --test server/visitValidation.test.ts` 通过；`pnpm typecheck` 通过
- `HANDOFF.md`：P0-5、P3-5 标完成；建议顺序第 5 项划掉

## 实现顺序（供 plan 展开）

1. TDD：先写 `visitValidation.test.ts` 失败用例，再实现 `visitValidation.ts`
2. 接入 `db.ts` / `index.ts`
3. 调整 `VisitForm` 校验与默认评分
4. 跑测试 + typecheck；更新 HANDOFF
