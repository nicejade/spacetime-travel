# 地图点选 / 地名搜索取坐标 — 设计文档

> 对应 HANDOFF P0 #1：降低录入门槛，替代手填经纬度。
> 目标文件：`client/components/VisitForm.svelte`（及新增支撑模块）。

## 背景

`spacetime-travel` 是离线优先、无 API key 的旅行记忆图谱。当前创建节点必须手工填写经纬度，是产品最大的使用门槛（HANDOFF「已知问题·高」）。

项目现状：

- `VisitForm.svelte` 用两个 `number` 输入框手填 `lat/lng`（现第 151–160 行）。
- `TravelCanvas.svelte` 用 `geoEquirectangular().fitSize([2400,1200], Sphere)` 投影渲染离线世界地图，`projection([lng,lat])` 把坐标转像素；反向 `projection.invert([x,y])` 可实现「点图取坐标」。
- 表单是覆盖在主画布上的模态弹窗，两者经 `App.svelte` 联动。
- 无任何现成地名库，仅有 `world-atlas` 的国家轮廓。
- 界面为中文（国家写作「日本」等）。

## 目标

1. 用户可在表单内嵌的迷你地图上**点击取坐标**，自动回填经纬度与所属国家。
2. 用户可通过**离线中英双语地名搜索**选择城市，自动回填名称、国家、经纬度。
3. 手填经纬度保留为可折叠的兜底入口。
4. 全程离线，不引入在线地理编码，不显著增大首屏体积。

## 非目标（YAGNI）

- 拼音搜索、标记拖拽、全屏取点、在线地理编码。
- 测试框架搭建（可选，见「验证」）。

## 关键设计决策

| 决策 | 选择 |
| --- | --- |
| 地名库数据源 | 精选数千主要城市，中英双语，懒加载，约 200–500KB |
| 生成方式 | 构建脚本从 GeoNames 生成并提交产物 JSON（方案 A） |
| 点选交互位置 | 表单内嵌迷你地图（自包含，不打断填写流程） |
| 语言 | 中英双语地名库 + 国家名映射为中文，与现有 UI 一致 |

## 架构

### 1. 数据生成（构建期，一次性）

- 新增脚本 `scripts/build-gazetteer.mjs`，通过 `pnpm build:gazetteer` 手动运行。
- 数据源：GeoNames `cities15000` + `alternateNamesV2`（筛 `isolanguage = zh`）。
- 筛选规则：人口 ≥ 100,000 的城市（约 4000 个）**加上**所有国家首都（feature code `PPLC`，保证小国首都不漏）。
- 每条记录用短键压缩：`{ z: 中文名, n: 英文名, cz: 国家中文名, c: ISO2, lat, lng, p: 人口 }`。
- 按「名称 + 国家」去重，保留人口最高者。
- 产物：
  - `client/lib/data/gazetteer.json`（压缩短键，目标 < 500KB），提交入库。
  - `client/lib/data/countries-zh.json`（ISO 数字码 → 国家中文名），供点图识别国家用。
- 日常开发只读已提交的 JSON，无需联网、无构建期依赖。
- **风险与兜底**：若构建环境无法访问 GeoNames，退到手工精选一份较小双语库（方案 B），运行时接口不变。

### 2. 运行时搜索 `client/lib/gazetteer.ts`

- `loadGazetteer()`：动态 `import('./data/gazetteer.json')` 懒加载（独立 chunk，不影响首屏），Promise 缓存。
- `searchPlaces(query, limit = 8)`：
  - 归一化查询：去空格、英文转小写并去音标。
  - 中文名 / 英文名 / 国家名任一命中即返回。
  - 排序：前缀匹配优先，其次人口降序。
- 不引入拼音依赖。

### 3. 共享地理工具 `client/lib/geo.ts`

- 抽出共享常量：`projection = geoEquirectangular().fitSize([2400,1200], Sphere)`、`countryFeatures`、`pathGenerator`。
- `countryAt(lng, lat): string`：用 `geoContains` 找到包含该点的国家 feature，经 `countries-zh.json` 映射为中文名；落在海洋返回空串。
- `TravelCanvas.svelte` 改为从此模块引用投影与国家轮廓，消除重复；其视图状态（pan/scale/播放等）仍自持，改动最小。

### 4. 组件 `client/components/LocationPicker.svelte`

沿用现有 Svelte 4 风格（`export let` + 回调）。状态由 `VisitForm` 持有，组件通过 props 接收当前值、通过回调上报选择。

**Props（约定）**

- `name: string`、`country: string`、`lat: number | string`、`lng: number | string`：当前值，用于渲染标记与读数。
- `onPick: (place: { name?: string; country?: string; lat: number; lng: number }) => void`：命中搜索或点图后回调。

**搜索区**

- 输入框 + 结果下拉：每项显示「中文名 · 英文名 · 国家 · 坐标」。
- 键盘支持：上 / 下移动高亮，回车选中，Esc 关闭下拉。
- 选中项 → `onPick({ name, country, lat, lng })`。
- 空查询不显示下拉。

**迷你地图区**

- 约 220px 高的 SVG 世界图，复用 `geo.ts` 的投影与 `world-atlas` 轮廓。
- 渲染当前坐标处的标记点。
- 点击任意处 → `projection.invert([x,y])` 得 `[lng,lat]` → `countryAt` 求国家 → `onPick({ country, lat, lng })`（不覆盖已填名称）。
- 轻量滚轮缩放 + 拖拽平移，便于微调定位。
- 底部显示当前 `lat / lng` 读数。
- v1 仅「点击落点」，标记拖拽留待后续。

### 5. 接入 `VisitForm.svelte`

- 在「地点 / 国家」区块上方嵌入 `LocationPicker`。
- 命中搜索或点图后写入现有 `values`：
  - 搜索命中：填 `locationName`、`country`、`lat`、`lng`。
  - 点图命中：填 `country`、`lat`、`lng`（保留用户已填名称）。
- 「地点 / 国家」文本框保留可编辑，搜索结果为预填、用户可覆盖。
- 原始「纬度 / 经度」数字框收进可折叠 `<details>「手动微调坐标」`，作为兜底，仍与地图标记双向同步。
- 校验逻辑不变（`lat/lng` 必填）。
- 编辑态：进入时 `LocationPicker` 依据已有坐标显示标记。

## 数据流

```
用户在 LocationPicker 搜索/点图
  → onPick(place)
  → VisitForm 更新 values.{locationName?, country, lat, lng}
  → 迷你地图标记与手动坐标框随 values 同步
  → 提交走既有 createVisit / updateVisit（payload 结构不变）
```

后端 API 与 `VisitPayload` 结构不变，本功能纯前端增强。

## 错误处理

- 地名库加载失败 → 搜索框提示「地名库加载失败，可用地图点选」，点图仍可用。
- 点击海洋（无国家）→ 坐标照常写入，国家留空，不报错。
- 坐标越界由既有 `min/max/step` 与必填校验兜底。

## 性能与体积

- `gazetteer.json` 经动态 `import` 拆为独立懒加载 chunk，首屏不受影响。
- 迷你地图复用已引入的 `world-atlas`，不新增静态资源。

## 验证

项目当前无测试框架，本期用手动验证清单：

1. 搜索一个城市（中/英）→ 名称、国家、经纬度自动填充。
2. 在迷你地图点击某国陆地 → 经纬度与国家中文名填充。
3. 点击海洋 → 仅坐标填充、国家留空、无报错。
4. 展开「手动微调坐标」改数值 → 地图标记同步移动。
5. 保存后节点出现在主画布正确位置。
6. 编辑已有节点 → 迷你地图显示其已有位置。

可选：引入 Vitest，为 `searchPlaces` 与 `countryAt` 补单元测试（默认不做，避免扩大范围）。

## 影响文件清单

新增：

- `scripts/build-gazetteer.mjs`
- `client/lib/data/gazetteer.json`
- `client/lib/data/countries-zh.json`
- `client/lib/gazetteer.ts`
- `client/lib/geo.ts`
- `client/components/LocationPicker.svelte`

修改：

- `client/components/VisitForm.svelte`（嵌入取坐标 UI）
- `client/components/TravelCanvas.svelte`（改用 `geo.ts` 共享投影）
- `package.json`（新增 `build:gazetteer` 脚本）
