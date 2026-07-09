# 一键生成旅行海报 / 分享图 — 设计文档

> 对应数据资产 P2：将当前年份筛选下的地图轨迹与统计数据渲染为竖版分享海报，先 SVG 后 PNG，纯本地处理，无需账号系统。
> 目标文件：`client/lib/poster/`（新增）、`client/components/PosterPreview.svelte`（新增）、`App.svelte`。

## 背景

`spacetime-travel` 是离线 SVG 旅行记忆图谱（Svelte 5 + `d3-geo` + SQLite）。电影模式已实现 WebM 视频导出（`client/lib/movie/engine.ts` 的 `renderSvgToCanvas`），但尚无静态海报或社交分享图能力。

产品希望提供「年度总结」风格的旅行海报：一键生成当前年份的旅行足迹图，供微信、小红书等场景分享。这是本地应用最自然的「输出」形态之一。

## 目标

1. **年份旅行海报**：基于当前年份筛选（`selectedYear`），生成该年度的竖版分享图。
2. **地图 + 轨迹 + 统计**：海报包含自动取景的地图、该年全部路线与节点，以及核心统计数据。
3. **SVG → PNG 管线**：独立 Poster SVG 模板组装完整画面，序列化后转 PNG（复用电影模式导出思路）。
4. **预览后确认**：生成后先展示预览模态，用户确认后再下载或系统分享。
5. **纯本地**：全部在浏览器端完成，不依赖账号或云端服务。

## 非目标（YAGNI）

- 「全部年份」汇总海报（需先选择具体年份）。
- 自定义画幅 / 多模板切换。
- 总里程、总天数统计（`distanceKm` / `durationHours` 未填充）。
- 国家标签云、代表性感受文案（精简版仅三个数字）。
- 二维码、外链分享、社交平台直发 API。
- 截取当前屏幕平移/缩放状态（海报使用独立自动取景）。
- HTML + html2canvas 方案（不符合现有 SVG 导出管线）。

## 关键设计决策

| 决策 | 选择 |
| --- | --- |
| 实现架构 | 专用 Poster SVG 模板模块（方案 A） |
| 数据范围 | 当前年份筛选下的 `visibleVisits` / `visibleLegs` |
| 画幅 | 竖版 4:5，1080 × 1440 px |
| 地图取景 | 自动适配该年全部节点与路线，居中展示 |
| 信息层 | 大标题 + 节点数 / 地区数 / 均分 |
| 交互 | 先预览模态，再下载 / 分享 |
| 导出格式 | PNG |
| 入口 | 左侧边栏统计区下方「生成海报」按钮 |

## 架构

### 模块划分

```
App.svelte
├── posterPreviewOpen: boolean
├── posterBlob: Blob | null
├── posterGenerating: boolean
├── 侧边栏「生成海报」按钮
└── PosterPreview.svelte（预览模态）

client/lib/poster/
├── types.ts           — PosterOptions, PosterStats, PosterLayout
├── stats.ts           — computeYearStats(visits) → 节点/地区/均分
├── bounds.ts          — computePosterBounds(plottedVisits) → bounding box + camera
├── buildPosterSvg.ts  — 组装完整 1080×1440 SVG 字符串
└── renderPoster.ts    — SVG → Canvas → PNG Blob；buildPosterFilename()
```

### 数据流

1. 用户选择具体年份（非 `all`），点击「生成海报」。
2. `plotVisits(visibleVisits, yearColors)` → 屏幕坐标。
3. `computeYearStats(visibleVisits)` → `{ visitCount, countryCount, averageRating }`。
4. `computePosterBounds(plottedVisits, mapRegion)` → `{ pan, scale }`。
5. `buildPosterSvg({ year, stats, visits, legs, yearColor, camera })` → SVG 字符串。
6. `renderPosterPng(svgString)` → `Blob`（`image/png`）。
7. `PosterPreview` 展示 PNG → 用户点击「保存图片」或「分享」。

### 与现有模块的复用

| 模块 | 复用内容 |
| --- | --- |
| `client/lib/geo.ts` | `MAP_WIDTH` / `MAP_HEIGHT`、`projection`、`pathGenerator`、`countryFeatures` |
| `client/lib/movie/plotVisits.ts` | `plotVisits()` |
| `client/lib/movie/pathSampler.ts` | `buildRouteGeometry()` |
| `client/lib/format.ts` | `transportDash()` |
| `client/lib/movie/engine.ts` | `downloadBlob()`；`renderSvgToCanvas` 思路可抽取或平行实现 |
| `client/lib/years.ts` | `visitYear()`、`yearColor()` |

## 版式设计（1080 × 1440）

```
┌─────────────────────────────┐  ← 顶部装饰条（年份色渐变，高度 8px）
│  spacetime · TRAVEL         │  ← 品牌行（14px，#7b8f96）
│                             │
│      {year} 旅行足迹         │  ← 主标题（48px bold，年份色）
│                             │
│  ┌───────────────────────┐  │
│  │                       │  │
│  │    地图 + 轨迹 + 节点   │  │  ← 地图卡片区（约 900px 高，左右边距 48px）
│  │    （圆角 rx=24）       │  │
│  │                       │  │
│  └───────────────────────┘  │
│                             │
│   {n}        {n}      {n}   │  ← 三列数字（56px bold，#1e343e）
│  旅行节点   到访地区   均分    │  ← 标签（14px，#7b8f96）
│                             │
│  spacetime-travel           │  ← 底部水印（12px，#a8b8be）
└─────────────────────────────┘
```

### 视觉规范

- **背景**：`linear-gradient(135deg, #f3fbfb 0%, #faf7f2 48%, #eef6ef 100%)`，与 App `body` 背景一致。
- **顶部装饰**：年份色（`yearColors[selectedYear]`）到透明的水平渐变条。
- **地图卡片**：白色底 `#ffffff`，圆角 `rx=24`，阴影 `0 12px 40px rgba(25,47,65,0.12)`。
- **地图内容**：海洋渐变、经纬网、国家边界（样式对齐电影模式 `EXPORT_STYLE`）。
- **路线**：该年 `yearColor` 统一着色，`stroke-width: 4`，`opacity: 0.78`。
- **节点**：圆点 + 光晕（按 rating 缩放），不显示地名标签（避免拥挤）。
- **字体**：`Inter, ui-sans-serif, system-ui, sans-serif`。

### 地图取景算法（`bounds.ts`）

给定地图卡片区域尺寸 `(cardWidth, cardHeight)` 和该年所有节点的屏幕坐标：

1. 若节点数为 0：不生成（按钮已禁用）。
2. 若节点数为 1：以该点为中心，`scale = 1.4`（固定值，可微调）。
3. 若节点数 ≥ 2：
   - 计算所有节点 `(x, y)` 的 min/max bounding box。
   - 扩展 15% padding：`padX = (maxX - minX) * 0.15`，`padY` 同理。
   - `contentWidth = maxX - minX + 2 * padX`，`contentHeight = maxY - minY + 2 * padY`。
   - `scale = min(cardWidth / contentWidth, cardHeight / contentHeight)`，clamp 到 `[0.3, 3.0]`。
   - `centerX = (minX + maxX) / 2`，`centerY = (minY + maxY) / 2`。
   - `pan.x = cardOriginX + cardWidth / 2 - centerX * scale`。
   - `pan.y = cardOriginY + cardHeight / 2 - centerY * scale`。

路线几何复用 `buildRouteGeometry`，跨日期变更线拆段逻辑与 `TravelCanvas` 一致。

## 统计计算（`stats.ts`）

从 `visibleVisits` 客户端计算（不使用全局 `atlas.stats`，因其为全量数据）：

```ts
interface PosterStats {
  visitCount: number;
  countryCount: number;
  averageRating: number | null; // null 表示无评分
}

function computeYearStats(visits: Visit[]): PosterStats {
  const countries = new Set(visits.map((v) => v.location.country));
  const ratings = visits.map((v) => v.rating).filter((r) => r > 0);
  return {
    visitCount: visits.length,
    countryCount: countries.size,
    averageRating: ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null
  };
}
```

海报上 `averageRating === null` 时显示「—」。

## 预览模态（`PosterPreview.svelte`）

### 布局

- 全屏半透明遮罩（`rgba(25, 47, 65, 0.45)` + `backdrop-filter: blur(8px)`）。
- 中央海报预览图（`max-width: 90vw`，保持 4:5 比例，`border-radius: 12px`，轻阴影）。
- 底部操作栏（`glass-panel` 风格）：
  - **保存图片** — 主按钮，调用 `downloadBlob(png, filename)`。
  - **分享** — 次按钮，仅 `navigator.canShare?.({ files })` 为 true 时显示。
  - **关闭** — 文字按钮或 × 图标。

### 状态

| 状态 | UI |
| --- | --- |
| `posterGenerating` | 遮罩 + spinner +「正在生成海报…」 |
| `posterBlob` 就绪 | 展示预览图 + 操作栏 |
| 生成失败 | 错误提示 +「关闭」按钮 |

### 分享实现

```ts
async function sharePoster(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: filename });
  }
}
```

不支持时隐藏「分享」按钮，仅保留「保存图片」。

## 入口与按钮状态（`App.svelte`）

位置：左侧边栏 `atlas-sidebar` 统计格下方，新增「生成海报」按钮（`secondary-button` 或带 `Image` 图标的按钮）。

| 条件 | 行为 |
| --- | --- |
| `selectedYear === 'all'` | 禁用，title「请先选择具体年份」 |
| `visibleVisits.length === 0` | 禁用，title「该年暂无旅行记录」 |
| `posterGenerating` | 禁用，显示 loading |
| 其他 | 可点击，触发 `generatePoster()` |

`generatePoster()` 为 async 函数：设置 `posterGenerating = true` → 调用 poster 模块 → 设置 `posterBlob` → 打开 `PosterPreview`。

## 导出管线（`renderPoster.ts`）

```ts
const POSTER_WIDTH = 1080;
const POSTER_HEIGHT = 1440;

async function renderPosterPng(svgString: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    ctx.drawImage(image, 0, 0, POSTER_WIDTH, POSTER_HEIGHT);
    return await canvasToPngBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function buildPosterFilename(year: number): string {
  return `spacetime-travel-${year}.png`;
}
```

SVG 内所有样式必须内联（`<style>` 块或属性），不依赖组件 scoped CSS。

## 边界情况

| 场景 | 处理 |
| --- | --- |
| 仅 1 个节点 | 正常生成，地图聚焦该点，无路线 |
| 无评分数据 | 均分显示「—」 |
| 跨日期变更线路线 | 复用 `pathSampler` 拆段 |
| SVG / Canvas 渲染失败 | 预览模态显示错误，App 不崩溃 |
| `navigator.share` 不可用 | 隐藏分享按钮 |
| 用户快速重复点击 | `posterGenerating` 锁防止并发 |

## 文件变更清单

| 文件 | 变更 |
| --- | --- |
| `client/lib/poster/types.ts` | 新增 |
| `client/lib/poster/stats.ts` | 新增 |
| `client/lib/poster/bounds.ts` | 新增 |
| `client/lib/poster/buildPosterSvg.ts` | 新增 |
| `client/lib/poster/renderPoster.ts` | 新增 |
| `client/components/PosterPreview.svelte` | 新增 |
| `client/App.svelte` | 海报按钮、状态、生成逻辑、挂载预览组件 |

## 验证步骤

1. 选择有数据的具体年份 → 点击「生成海报」→ 预览模态展示正确海报。
2. 海报包含：年份标题、地图（自动取景）、路线、节点、三个统计数字、品牌水印。
3. 点击「保存图片」→ 下载 `spacetime-travel-{year}.png`，尺寸 1080×1440。
4. 在支持 Web Share API 的环境（移动端 Safari/Chrome）→「分享」按钮可见且可用。
5. `selectedYear === 'all'` 时按钮禁用。
6. 该年无 visit 时按钮禁用。
7. 仅 1 个节点、无评分等边界情况显示正常。
