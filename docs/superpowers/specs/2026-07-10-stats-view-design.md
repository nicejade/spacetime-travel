# 旅行统计页（Stats View）— 设计文档

> 对应数据洞察能力：在个人旅行记忆图谱中新增全屏统计视图，支持时间、地理、评分、标签四个维度的可视化分析。
> 目标文件：`client/lib/stats/`（新增）、`client/components/StatsView.svelte`（新增）、`App.svelte`（修改）。

## 背景

`spacetime-travel` 是离线 SVG 旅行记忆图谱（Svelte 5 + `d3-geo` + SQLite）。当前侧边栏仅展示 4 个 KPI（节点 / 地区 / 均分 / 时间跨度），海报模块复用其中 3 个数字，但缺少深度数据探索能力。

产品希望新增 **Stats View**：面向个人的旅行回顾仪表盘，帮助用户从时间、地理、评分、标签等维度洞察自己的旅行模式。与海报（可分享的年度快照）和电影模式（时空叙事）形成互补。

## 目标

1. **全屏统计页**：侧栏入口，主区域切换为 Stats 全屏视图，可返回地图（类似 `movieActive` 的 view 切换）。
2. **独立年份筛选**：Stats 页内 `statsYear` 独立于地图 `selectedYear`，默认「所有年份」，互不影响。
3. **四个洞察模块**：时间趋势、地理分布、评分分析、标签与主题。
4. **纯本地计算**：基于已有 `atlas.visits` / `atlas.legs` 在客户端聚合，不新增 API。
5. **视觉一致**：复用 `glass-panel`、年份色、`trip-filter` pills 等现有设计语言；图表用内联 SVG + CSS，零新依赖。

## 非目标（YAGNI）

- 交通方式、心情/天气、停留时长模块（v1 排除）。
- 总里程 / 总旅途时长（`distanceKm` / `durationHours` 多数未填）。
- 导出 Stats 图片 / PDF。
- 点击图表跳转地图节点。
- 后端新 API 或持久化统计结果。
- 引入 Chart.js / LayerChart 等图表库（v1 用 SVG/CSS）。

## 关键设计决策

| 决策 | 选择 |
| --- | --- |
| 产品定位 | 个人回顾仪表盘（非分享报告） |
| 实现架构 | 纯 Svelte + 轻量 SVG/CSS 图表（方案 A） |
| 页面结构 | 全屏 Stats 页，侧栏「统计」入口（方案 A） |
| 年份筛选 | Stats 独立 `statsYear`，默认 `all`（方案 Y2） |
| 数据范围 | 客户端过滤 `atlas.visits`，legs 本版不参与模块计算 |
| 洞察模块 | 时间趋势、地理分布、评分分析、标签与主题 |
| 测试 | `compute.test.ts` 单元测试 + 手动 UI 验证 |

## 架构

### 模块划分

```
App.svelte
├── activeView: 'map' | 'stats'
├── statsYear: number | 'all'          // 默认 'all'
├── 侧栏「统计」按钮（BarChart3 图标）
├── activeView === 'stats' → StatsView.svelte
└── movieActive 时隐藏侧栏（含 Stats 入口）

StatsView.svelte
├── 顶栏：← 返回地图 · 标题 · 年份 pills
├── KPI 行：节点 / 地区 / 均分 / 跨度
└── 2×2 网格：四个模块卡片

client/lib/stats/
├── types.ts           — StatsSnapshot 及各子结构
├── filter.ts          — filterVisits(visits, statsYear)
├── compute.ts         — computeStatsSnapshot(visits, statsYear)
└── compute.test.ts    — 聚合逻辑单元测试

client/components/stats/   （可选拆分）
├── TimeTrendCard.svelte
├── GeoDistributionCard.svelte
├── RatingAnalysisCard.svelte
└── TagThemesCard.svelte
```

### 数据流

1. 用户点击侧栏「统计」→ `activeView = 'stats'`。
2. `filterVisits(atlas.visits, statsYear)` → 过滤后的 visit 列表。
3. `computeStatsSnapshot(filteredVisits)` → `StatsSnapshot`（KPI + 四模块数据）。
4. `StatsView` 渲染 KPI 行与 2×2 模块网格。
5. 用户切换 `statsYear` pills → 重新计算并渲染。
6. 点击「返回地图」→ `activeView = 'map'`，地图 `selectedYear` 不变。

### 与现有模块的复用

| 模块 | 复用内容 |
| --- | --- |
| `client/lib/format.ts` | `splitTags()` 解析标签 |
| `client/lib/years.ts` | `visitYear()`、`yearColors` |
| `client/lib/poster/stats.ts` | 均分计算逻辑（节点/地区/均分） |
| `client/lib/types.ts` | `Visit`、`AtlasStats`（KPI 可扩展） |
| `App.svelte` | `glass-panel`、`trip-filter` 样式模式 |

## UI 布局

```
┌─────────────────────────────────────────┐
│ ← 返回地图    旅行统计    [年份 pills]   │
├─────────────────────────────────────────┤
│  节点  │  地区  │  均分  │  跨度        │  ← KPI 行（4 格）
├──────────────────┬──────────────────────┤
│  时间趋势         │  地理分布             │
├──────────────────┼──────────────────────┤
│  评分分析         │  标签与主题           │
└──────────────────┴──────────────────────┘
```

- 桌面：2×2 模块网格；KPI 单行 4 列。
- 移动端（`< 768px`）：模块与 KPI 均单列堆叠。

## 模块规格

### KPI 行

| KPI | 计算 |
| --- | --- |
| 节点 | `filteredVisits.length` |
| 地区 | 去重 `location.country` 数量 |
| 均分 | 有评分（`rating > 0`）记录的算术平均，保留 1 位小数；无数据时 `—` |
| 跨度 | `min(year) – max(year)`；单年时仅显示该年 |

### 模块 1 · 时间趋势

- **按年柱状图**（`statsYear === 'all'`）：每年 visit 数量，柱色用 `yearColors[year]`。
- **按月分布**（`statsYear` 为具体年份）：12 个月 visit 数柱状图。
- **文字摘要**：最忙月份，如「2024 年 8 月最活跃（3 次）」。

### 模块 2 · 地理分布

- **国家排行 Top 8**：水平条形图 + 数量。
- **地点排行 Top 8**：按 `location.name` 聚合。
- **简表**：国家名、访问次数、首次到访年份。

### 模块 4 · 评分分析

- **1–5 星分布**：5 行水平条 + 计数与百分比。
- **均分按年**（`statsYear === 'all'`）：年度均分折线或柱。
- **高分地点 Top 5**：`rating >= 4`，按分数降序，展示地点名 + 分数。

### 模块 5 · 标签与主题

- 使用 `splitTags(visit.tags)` 解析（逗号 / 中文逗号分隔）。
- **热门标签 Top 10**：水平条。
- **摘要**：「共 N 个不同标签，M 次标记」。

## 错误处理与边界情况

| 场景 | 处理 |
| --- | --- |
| `atlas` 尚未加载 | Stats 入口 disabled；或进入后显示「正在载入…」 |
| 过滤后 0 条 visit | KPI 为 0 / `—`；各模块统一空态，不渲染空图表轴 |
| 单年筛选但该年无数据 | 允许选择；显示「该年暂无旅行记录」 |
| 标签 / 评分字段为空 | 对应模块显示引导文案，不报错 |
| 数据量 | 个人场景 < 500 visits，同步计算即可，无需 Worker |

## 无障碍

- 顶栏与年份 pills 支持键盘导航。
- 图表区域提供 `aria-label`（如「按年访问频次」）。
- 关键数值以文字摘要呈现，不仅依赖图形。

## 测试计划

| 类型 | 内容 |
| --- | --- |
| 单元测试 | `compute.test.ts`：年份过滤、国家计数、标签聚合、评分分布、空数据 |
| 手动测试 | 进入/返回 Stats、独立年份切换、全量/单年、空 seed、移动端布局 |

## 实现清单

| 文件 | 操作 |
| --- | --- |
| `client/lib/stats/types.ts` | 新增 |
| `client/lib/stats/filter.ts` | 新增 |
| `client/lib/stats/compute.ts` | 新增 |
| `client/lib/stats/compute.test.ts` | 新增 |
| `client/components/StatsView.svelte` | 新增 |
| `client/components/stats/*.svelte` | 新增（按需拆分） |
| `App.svelte` | 修改：`activeView`、`statsYear`、侧栏入口 |

## 备选方案（已否决）

| 方案 | 否决原因 |
| --- | --- |
| B · 引入 Chart 库 | 新依赖与风格适配成本；v1 图表需求简单 |
| C · 侧栏内 Tab | 展示空间不足，不符合仪表盘定位 |
| B · 右侧抽屉 | 图表空间窄，洞察感弱 |
| Y1 · 继承地图年份筛选 | 用户选择独立筛选，便于对比不同范围 |
