# 路线动画播放升级为「电影模式」— 设计文档

> 对应 HANDOFF「记忆升维」：将 `TravelCanvas` 中 `setInterval` 跳节点的播放，升级为沿路径移动的光点、交通方式差异化镜头、停留字幕，以及无声 WebM 视频导出。
> 目标文件：`client/lib/movie/`（新增）、`client/components/MovieOverlay.svelte`（新增）、`TravelCanvas.svelte`、`App.svelte`。

## 背景

`spacetime-travel` 是离线 SVG 旅行记忆图谱（Svelte 5 + `d3-geo`）。当前播放逻辑在 `TravelCanvas.svelte`：

- `setInterval` 每 1.3s 跳到下一 visit 节点
- `focusVisit()` 瞬间切换镜头，无过渡
- 播放期间不展示 `feeling` 等情感字段
- 无导出能力

产品希望将播放升级为「电影模式」：光点沿路线移动、镜头平滑插值、每站淡入感受文字，并支持导出无声视频供分享。

## 目标

1. **替换现有播放按钮**：点播放即进入全屏电影模式（侧栏 / 时间轴 / 详情面板自动隐藏）。
2. **沿路径移动的光点**：光点沿 leg 的二次贝塞尔路径匀速移动，当前路段高亮。
3. **交通方式差异化镜头**：飞行偏高弧线、火车贴地跟拍、渡轮水平缓移等（2D 平面地图上的视觉模拟）。
4. **停留字幕**：每站停留 2.5s，淡入地点名 + 日期 + `feeling`。
5. **固定节奏**：每段路途 3.5s，每站停留 2.5s。
6. **尊重年份筛选**：仅播放当前 `visibleVisits` / `visibleLegs`。
7. **无声 WebM 导出**：共用同一时间轴引擎，离屏 Canvas 逐帧录制后下载。

## 非目标（YAGNI）

- 带声音 / 背景音乐 / 环境音。
- MP4 导出（需 `ffmpeg.wasm`，留作后续）。
- 独立网页链接分享（需托管）。
- 静态海报 / 截图导出（另开设计）。
- 3D 地图或真实地形（保持现有 2D SVG）。
- 播放前选择全局镜头风格（交通方式已足够区分）。
- 保留旧版「跳点预览」播放（完全替换）。

## 关键设计决策

| 决策 | 选择 |
| --- | --- |
| 实现架构 | 独立 `MovieEngine` 模块 + `MovieOverlay` 组件（方案二） |
| 进入方式 | 替换现有播放按钮，一点即全屏 |
| 播放范围 | 尊重当前年份筛选 |
| 停留字幕 | 地点名 + 日期 + `feeling` |
| 镜头风格 | 按交通方式区分（飞行 / 火车 / 渡轮 / 自驾 / 巴士 / 步行） |
| 节奏 | 路途 3.5s + 停留 2.5s，固定时长 |
| 导出格式 | 无声 WebM（VP9，降级 VP8） |
| 导出分辨率 | 与视口等比，最大边 1920px |
| 日界线 | 顺带修复：`pathSampler` 拆段，`routePath` 同步 |

## 架构

### 模块划分

```
App.svelte
├── movieActive: boolean          ← 全屏时隐藏侧栏 / 时间轴 / 详情面板
├── TravelCanvas.svelte           ← 接收 movieState，渲染光点 + 镜头变换
└── MovieOverlay.svelte           ← 全屏遮罩：字幕、控制条、导出按钮

client/lib/movie/
├── types.ts          ← MoviePhase, MovieSegment, CameraState, TransportRig
├── timeline.ts       ← 主时钟：把 legs 序列化为 TRAVEL | DWELL 阶段
├── pathSampler.ts    ← 二次贝塞尔采样 + 日界线拆段
├── cameraRig.ts      ← 按交通方式计算镜头目标 (pan, scale)
├── engine.ts         ← 组合以上模块，对外暴露 tick(t) → 渲染状态
└── export.ts         ← 离屏 Canvas 录制 → WebM 下载
```

### 数据流

1. 用户点播放 → `App` 设 `movieActive = true`，用当前 `visibleVisits` / `visibleLegs` 构建 `MovieSequence`。
2. `engine.start()` 启动 rAF 循环，每帧 `engine.tick(now)` 返回：
   - `pathProgress`（0–1，光点在路线上的位置）
   - `camera`（`pan.x`, `pan.y`, `scale`）
   - `phase`（`'travel'` | `'dwell'`）
   - `activeVisit`（当前节点）
   - `activeLeg`（当前路段，travel 阶段才有）
3. `TravelCanvas` 用返回值更新 `pan` / `scale`，并渲染移动光点 `<circle>`。
4. `MovieOverlay` 在 `dwell` 阶段淡入字幕（地点名 + 日期 + feeling）。
5. 序列结束或用户退出 → `movieActive = false`，恢复交互。

### 模块职责

| 模块 | 职责 | 不改什么 |
| --- | --- | --- |
| `TravelCanvas` | 渲染地图、应用镜头状态、显示光点 | 手动平移 / 缩放逻辑保留，电影模式期间禁用 |
| `App.svelte` | 全屏状态、传递筛选后的 visits / legs | 数据加载、年份筛选逻辑不动 |
| `movie/engine` | 纯计算，无 DOM 依赖 | 可独立单测 |
| `MovieOverlay` | UI 层：字幕、进度、退出 / 暂停 / 导出 | 不碰地图渲染 |

### 日界线处理

`pathSampler.ts` 检测相邻 visit 的 `|Δlng| > 180°` 时，将路段拆为两段贝塞尔（经地图边缘绕行）。光点沿拆段路径连续移动。`TravelCanvas.routePath` 同步改用同一采样器，修复 HANDOFF 已知问题（跨太平洋航线横穿地图）。

## 播放体验

### 时间轴结构

一次完整播放 = **N 个节点** + **N−1 段路途**（按 `arrivedAt` 排序后的 `visibleVisits`）：

```
[Dwell 首站 2.5s] → [Travel leg₁ 3.5s] → [Dwell 站₂ 2.5s] → [Travel leg₂ 3.5s] → … → [Dwell 末站 2.5s] → 结束
```

| 阶段 | 时长 | 行为 |
| --- | --- | --- |
| **Dwell**（停留） | 2.5s | 镜头定在当前节点，字幕淡入 |
| **Travel**（路途） | 3.5s | 光点沿路线移动，镜头跟随 |

总时长：`(visitCount × 2.5) + (legCount × 3.5)` 秒。例：5 站 4 段 ≈ 26.5s。

缓动：Travel 用 `easeInOutCubic`；Dwell 字幕用 0.6s `ease-out` 淡入，最后 0.4s 淡出。

### 光点

- 沿当前 leg 的二次贝塞尔路径移动（`pathSampler` 按弧长均匀采样）。
- 视觉：白色核心 + 年份色光晕 + `soft-glow` 滤镜，半径约 8px。
- Travel 阶段显示并移动；Dwell 阶段停在节点上，光晕脉冲（CSS `animation: pulse`）。
- 当前 leg 路线高亮（`opacity: 1` + 加粗），其余路线降至 `opacity: 0.25`。

### 交通方式镜头参数

镜头目标由 `cameraRig.ts` 根据光点位置 + 交通方式计算：

| 交通 | 镜头风格 | scale 目标 | 特点 |
| --- | --- | --- | --- |
| **flight** 飞行 | 航拍弧线 | 0.95–1.2 | 光点前方偏移 120px，模拟俯瞰；路途前半段缓拉远、后半段缓推近 |
| **train** 火车 | 贴地跟拍 | 1.1–1.4 | 偏移 40px，紧贴路径；scale 较高 |
| **ferry** 渡轮 | 水平缓移 | 0.8–1.0 | 偏移 60px，scale 偏低，偏「远景航行」 |
| **drive** 自驾 | 公路视角 | 1.0–1.3 | 偏移 50px，中等跟拍 |
| **bus** 巴士 | 同自驾，略慢 | 1.0–1.2 | 同 drive，Travel 时长仍 3.5s |
| **walk** 步行 | 近景漫步 | 1.3–1.6 | 偏移 20px，最高倍率 |

每帧对 `pan` / `scale` 做 lerp（系数约 0.08），保证平滑而非硬切。

### 字幕层（MovieOverlay）

Dwell 阶段居中偏下显示，半透明毛玻璃底（沿用 `glass-panel` 风格）：

- **标题行**：`{地点名} · {日期}`（15px, font-weight 600）
- **正文**：`feeling`（20px, font-weight 400, 斜体）
- `feeling` 为空时只显示标题 + 灰色「未记录感受」占位
- 最大宽度 480px，超出换行

日期格式复用 `formatMonth(visit.arrivedAt)`（如「2024年3月」）。

### 全屏控制条

电影模式底部居中，播放期间显示，3s 无操作自动隐藏（鼠标移动再出现）：

| 按钮 | 行为 |
| --- | --- |
| ⏸ / ▶ | 暂停 / 继续 |
| ⏹ | 退出电影模式，恢复侧栏 |
| ⬇ | 导出无声 WebM |
| 进度条 | 显示总进度，可拖拽跳转 |

键盘：`Space` 暂停 / 继续，`Esc` 退出。

## 视频导出

### 导出流程

1. 用户点 ⬇ 导出（或播放结束后提示「导出本次旅程」）。
2. 按钮进入 loading：「正在录制…」。
3. 引擎以**固定 30fps** 离线跑完整时间轴（不依赖实时 rAF，避免长路线掉帧）。
4. 每帧把当前画面绘制到离屏 Canvas，送入 `MediaRecorder`。
5. 录制结束 → 触发浏览器下载。

### 技术方案

```
movie/export.ts
├── createExportCanvas(viewportW, viewportH)  → 离屏 <canvas>
├── renderFrame(ctx, engineState, svgElement) → SVG → Canvas 绘制
├── recordTimeline(engine, canvas, fps=30)    → MediaRecorder 逐帧录制
└── downloadBlob(blob, filename)              → 触发 <a download>
```

**SVG → Canvas 绘制**：每帧将当前 SVG 状态序列化为 Blob URL，用 `Image` 加载后 `ctx.drawImage()`。26s × 30fps ≈ 795 帧，预估 10–20s 完成。

**编码格式**：`video/webm;codecs=vp9`，无声。Safari 不支持 VP9 时降级为 `video/webm;codecs=vp8`。

**分辨率**：与当前视口等比，最大边 1920px（例：视口 1280×820 → 导出 1920×1230）。

### 导出期间 UI

- 全屏遮罩显示进度：「正在生成视频 42%」。
- 导出过程中禁用暂停 / 拖拽。
- 用户可按 `Esc` 取消，中止 `MediaRecorder` 并清理。

### 文件命名

```
spacetime-travel-2024.webm          ← 年份筛选激活时
spacetime-travel-2024-2026.webm     ← 播放全部时，取首尾年份
spacetime-travel.webm               ← 仅一站、无年份信息时
```

## 边界情况与错误处理

| 场景 | 处理 |
| --- | --- |
| 0 个节点 | 播放按钮 disabled，不进入电影模式 |
| 1 个节点（无 leg） | 只播 2.5s Dwell，显示字幕后结束 |
| `feeling` 为空 | 字幕只显示地点 + 日期 + 灰色「未记录感受」 |
| 跨日界线 leg | `pathSampler` 拆段，光点沿拆段路径连续移动 |
| 播放中切换年份筛选 | 不允许（电影模式期间侧栏已隐藏） |
| `MediaRecorder` 不支持 | 导出按钮隐藏，仅保留回放；控制台 warn |
| 导出中途失败 | Toast「导出失败，请重试」，回到播放结束态 |
| 超长旅程（>50 站） | 正常播放；导出预估 >60s 时显示「可能需要一分钟」 |

## 测试策略

| 层级 | 覆盖 |
| --- | --- |
| **单元测试**（Vitest） | `timeline.ts` 阶段序列化、`pathSampler.ts` 贝塞尔采样与日界线拆段、`cameraRig.ts` 交通参数 |
| **手动验证** | 2 站 / 5 站 / 跨太平洋路线各跑一遍；导出 WebM 可正常播放 |
| **不测** | Canvas 逐帧渲染（集成成本高，手动覆盖即可） |

## 验证清单

- [ ] 点播放进入全屏，侧栏 / 时间轴 / 详情面板隐藏
- [ ] 光点沿路线平滑移动，不同交通方式镜头风格可区分
- [ ] 每站停留时字幕正确淡入（地点 + 日期 + feeling）
- [ ] 跨日界线路线不再横穿地图
- [ ] 年份筛选只播放对应节点
- [ ] 暂停 / 继续 / 退出 / 进度拖拽正常
- [ ] 导出 WebM 可下载并在本地播放器正常播放
- [ ] 0 站 / 1 站边界情况行为正确
