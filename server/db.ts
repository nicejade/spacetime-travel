import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureLocation, purgeOrphanLocations } from './locations.js';
import { migrate } from './migrations.js';
import { rebuildSequencesAndLegs } from './rebuildLegs.js';
import type { HttpError, ParsedVisitPayload, VisitPayloadInput } from './types.js';
import { assertDateOrder, parseIsoDate, parseTransport } from './visitValidation.js';
import { buildVisitRoutes } from './visitRoutes.js';

function httpError(status: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  error.statusCode = status;
  return error;
}

/** Mirrors client/lib/years.ts — keep in sync. */
const YEAR_PALETTE = [
  '#dd6f5c',
  '#2d7c89',
  '#6d8f58',
  '#5b6bb5',
  '#c45c26',
  '#8b5a7c',
  '#3d8b8b',
  '#a46c21'
] as const;

const YEAR_PALETTE_EPOCH = 2018;

function visitYear(arrivedAt: string): number {
  return Number(String(arrivedAt).slice(0, 4));
}

function yearColor(year: number): string {
  const index = Math.abs(year - YEAR_PALETTE_EPOCH) % YEAR_PALETTE.length;
  return YEAR_PALETTE[index];
}

function buildYearColors(years: number[]): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const year of years) {
    colors[String(year)] = yearColor(year);
  }
  return colors;
}

interface LegRow {
  id: number;
  from_visit_id: number;
  to_visit_id: number;
  transport: string;
  duration_hours: number | null;
  distance_km: number | null;
  note: string;
  sequence: number;
}

interface DbVisitRow {
  id: number;
  location_id: number;
  origin_location_id: number;
  returns_to_origin: number;
  outbound_transport: string;
  outbound_note: string;
  return_transport: string | null;
  return_note: string;
  inbound_transport: string | null;
  inbound_note: string | null;
  sequence: number;
  arrived_at: string;
  departed_at: string | null;
  feeling: string;
  food: string;
  rating: number;
  mood: string;
  weather: string;
  memory: string;
  tags: string;
}

interface VisitRow {
  id: number;
  location_id: number;
  origin_location_id: number;
  returns_to_origin: number;
  outbound_transport: string;
  outbound_note: string;
  return_transport: string | null;
  return_note: string;
  inbound_transport: string | null;
  inbound_note: string | null;
  arrived_at: string;
  departed_at: string | null;
  feeling: string;
  food: string;
  rating: number;
  mood: string;
  weather: string;
  memory: string;
  tags: string;
  sequence: number;
  location_name: string;
  country: string;
  lat: number;
  lng: number;
  kind: string;
  origin_id: number;
  origin_name: string;
  origin_country: string;
  origin_lat: number;
  origin_lng: number;
  origin_kind: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'spacetime-travel.sqlite');

fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
migrate(db);

interface SeedVisit {
  location: [string, string, number, number];
  origin: [string, string, number, number];
  returnsToOrigin?: boolean;
  outboundTransport?: string;
  outboundNote?: string;
  returnTransport?: string;
  returnNote?: string;
  transport?: string;
  legNote?: string;
  arrivedAt: string;
  departedAt: string;
  feeling: string;
  food: string;
  rating: number;
  mood: string;
  weather: string;
  memory: string;
  tags: string;
}

const seedVisits: SeedVisit[] = [
  {
    origin: ['杭州', '中国', 30.2741, 120.1551],
    location: ['上海', '中国', 31.2304, 121.4737],
    arrivedAt: '2019-03-28',
    departedAt: '2019-03-30',
    outboundTransport: 'train',
    outboundNote: '从杭州东站出发，第一次把家留在身后。',
    returnsToOrigin: true,
    feeling: '从熟悉的江边出发，心里有一种把日常轻轻折起来的感觉。',
    food: '葱油拌面、小笼、热豆浆',
    rating: 4.2,
    mood: '启程',
    weather: '阴转晴',
    memory: '行李很轻，计划也很轻。',
    tags: '出发,城市,春天'
  },
  {
    origin: ['上海', '中国', 31.2304, 121.4737],
    location: ['京都', '日本', 35.0116, 135.7681],
    arrivedAt: '2019-04-01',
    departedAt: '2019-04-06',
    transport: 'flight',
    legNote: '清晨航班落地大阪，再一路坐电车进京都。',
    outboundTransport: 'flight',
    outboundNote: '从上海浦东出发。',
    returnsToOrigin: true,
    feeling: '鸭川边的风把时间放慢，寺院的木香和雨后的石板路都很温柔。',
    food: '抹茶、汤豆腐、鲭鱼寿司',
    rating: 4.8,
    mood: '柔软',
    weather: '小雨',
    memory: '傍晚沿着鸭川走到灯亮。',
    tags: '樱花,寺院,慢旅行'
  },
  {
    origin: ['京都', '日本', 35.0116, 135.7681],
    location: ['首尔', '韩国', 37.5665, 126.978],
    arrivedAt: '2019-04-08',
    departedAt: '2019-04-12',
    transport: 'flight',
    legNote: '从关西飞往仁川，城市节奏忽然变快。',
    outboundTransport: 'flight',
    outboundNote: '从京都站附近酒店出发，直奔关西机场。',
    returnsToOrigin: true,
    feeling: '山和高楼挤在一起，咖啡馆像很多临时停靠的小岛。',
    food: '参鸡汤、烤肉、冷面',
    rating: 4.4,
    mood: '清醒',
    weather: '晴',
    memory: '夜里从南山看整座城市。',
    tags: '夜景,咖啡,城市'
  },
  {
    origin: ['首尔', '韩国', 37.5665, 126.978],
    location: ['伊斯坦布尔', '土耳其', 41.0082, 28.9784],
    arrivedAt: '2022-09-06',
    departedAt: '2022-09-11',
    transport: 'flight',
    legNote: '长途飞行后在欧洲边缘降落。',
    outboundTransport: 'flight',
    outboundNote: '从仁川出发，跨越半个地球。',
    returnsToOrigin: true,
    feeling: '海峡两岸的风把东西方缝在一起，轮渡声像一天的标点。',
    food: '烤鱼三明治、土耳其红茶、开心果甜点',
    rating: 4.7,
    mood: '辽阔',
    weather: '晴热',
    memory: '坐轮渡横过博斯普鲁斯海峡。',
    tags: '海峡,集市,轮渡'
  },
  {
    origin: ['伊斯坦布尔', '土耳其', 41.0082, 28.9784],
    location: ['雅典', '希腊', 37.9838, 23.7275],
    arrivedAt: '2022-09-14',
    departedAt: '2022-09-18',
    transport: 'ferry',
    legNote: '一段海上移动，像把地图摊在风里。',
    outboundTransport: 'ferry',
    outboundNote: '从伊斯坦布尔码头出发，爱琴海风很大。',
    returnsToOrigin: true,
    feeling: '白色街巷和强烈日光让每个转角都显得直接。',
    food: '烤羊肉、希腊酸奶、橄榄',
    rating: 4.3,
    mood: '明亮',
    weather: '晴',
    memory: '黄昏时卫城的石头变成蜂蜜色。',
    tags: '遗迹,海风,日落'
  },
  {
    origin: ['雅典', '希腊', 37.9838, 23.7275],
    location: ['罗马', '意大利', 41.9028, 12.4964],
    arrivedAt: '2022-09-21',
    departedAt: '2022-09-26',
    transport: 'flight',
    legNote: '短飞抵达，下一段改用火车。',
    outboundTransport: 'flight',
    outboundNote: '从雅典机场起飞，落地罗马。',
    returnsToOrigin: true,
    feeling: '古老和日常没有边界，喷泉边的聊天声也像历史的一部分。',
    food: 'Carbonara、Gelato、浓缩咖啡',
    rating: 4.6,
    mood: '饱满',
    weather: '晴',
    memory: '夜里走过万神殿前的小广场。',
    tags: '古城,美食,步行'
  },
  {
    origin: ['罗马', '意大利', 41.9028, 12.4964],
    location: ['巴黎', '法国', 48.8566, 2.3522],
    arrivedAt: '2022-09-28',
    departedAt: '2022-10-04',
    transport: 'train',
    legNote: '沿欧洲铁路北上，窗外的光线越来越凉。',
    outboundTransport: 'train',
    outboundNote: '从罗马特米尼站北上。',
    returnsToOrigin: true,
    feeling: '它比想象中更日常，也更私人；桥、河和书店让人愿意多停几天。',
    food: '可颂、洋葱汤、鸭胸',
    rating: 4.5,
    mood: '松弛',
    weather: '多云',
    memory: '塞纳河边的长椅和一本没读完的书。',
    tags: '博物馆,河岸,书店'
  },
  {
    origin: ['巴黎', '法国', 48.8566, 2.3522],
    location: ['里斯本', '葡萄牙', 38.7223, -9.1393],
    arrivedAt: '2022-10-07',
    departedAt: '2022-10-13',
    transport: 'train',
    legNote: '西行到海边，结束在电车和坡道之间。',
    outboundTransport: 'train',
    outboundNote: '从巴黎出发，一路向西到海边。',
    returnsToOrigin: false,
    feeling: '坡道、瓷砖和大西洋的光都带着一点旧电影的颗粒感。',
    food: '蛋挞、海鲜饭、鳕鱼球',
    rating: 4.9,
    mood: '眷恋',
    weather: '晴有风',
    memory: '黄昏在阿尔法玛区听到一小段法朵。',
    tags: '海边,坡道,音乐'
  },
  {
    origin: ['里斯本', '葡萄牙', 38.7223, -9.1393],
    location: ['开普敦', '南非', -33.9249, 18.4241],
    arrivedAt: '2024-01-09',
    departedAt: '2024-01-15',
    transport: 'flight',
    legNote: '跨越大西洋，季节忽然颠倒。',
    outboundTransport: 'flight',
    outboundNote: '从里斯本起飞，向南半球。',
    returnsToOrigin: true,
    feeling: '桌山压着海风，城市边缘有一种开阔又锋利的美。',
    food: '海鲜、Bobotie、Rooibos 茶',
    rating: 4.4,
    mood: '开阔',
    weather: '晴风大',
    memory: '日落时海面像一块很冷的银。',
    tags: '海岸,山,夏天'
  },
  {
    origin: ['开普敦', '南非', -33.9249, 18.4241],
    location: ['布宜诺斯艾利斯', '阿根廷', -34.6037, -58.3816],
    arrivedAt: '2024-01-20',
    departedAt: '2024-01-27',
    transport: 'flight',
    legNote: '跨过南大西洋，时间感被航程拉长。',
    outboundTransport: 'flight',
    outboundNote: '从开普敦出发，向南美。',
    returnsToOrigin: true,
    feeling: '街道有音乐和树影，很多下午都像被探戈拖慢了一拍。',
    food: '牛排、Empanadas、Malbec',
    rating: 4.6,
    mood: '热烈',
    weather: '炎热',
    memory: '在 San Telmo 的旧市场里看人跳舞。',
    tags: '探戈,市场,树影'
  },
  {
    origin: ['布宜诺斯艾利斯', '阿根廷', -34.6037, -58.3816],
    location: ['库斯科', '秘鲁', -13.5319, -71.9675],
    arrivedAt: '2024-02-01',
    departedAt: '2024-02-07',
    transport: 'flight',
    legNote: '飞进安第斯，高海拔让脚步自然变慢。',
    outboundTransport: 'flight',
    outboundNote: '从布宜诺斯艾利斯北上安第斯。',
    returnsToOrigin: true,
    feeling: '空气薄，天空近，石墙像把许多世纪都留在手边。',
    food: '藜麦汤、烤豚鼠、古柯茶',
    rating: 4.7,
    mood: '敬畏',
    weather: '多云阵雨',
    memory: '清晨爬坡时听见远处的钟声。',
    tags: '高原,遗迹,徒步'
  },
  {
    origin: ['库斯科', '秘鲁', -13.5319, -71.9675],
    location: ['墨西哥城', '墨西哥', 19.4326, -99.1332],
    arrivedAt: '2024-02-11',
    departedAt: '2024-02-18',
    transport: 'flight',
    legNote: '北上到高原都市，颜色和声音密度都变高。',
    outboundTransport: 'flight',
    outboundNote: '从库斯科出发，北上墨西哥。',
    returnsToOrigin: true,
    feeling: '街头食物、壁画和市场让城市像一本很厚的手账。',
    food: 'Tacos al pastor、Mole、玉米粥',
    rating: 4.8,
    mood: '丰盛',
    weather: '晴',
    memory: '在 Coyoacan 的蓝墙边慢慢散步。',
    tags: '街食,壁画,市场'
  }
];

const insertVisit = db.prepare(`
  INSERT INTO visits (
    location_id, origin_location_id, returns_to_origin,
    outbound_transport, outbound_note, return_transport, return_note,
    inbound_transport, inbound_note,
    arrived_at, departed_at, feeling, food, rating, mood, weather, memory, tags, sequence
  )
  VALUES (
    @locationId, @originLocationId, @returnsToOrigin,
    @outboundTransport, @outboundNote, @returnTransport, @returnNote,
    @inboundTransport, @inboundNote,
    @arrivedAt, @departedAt, @feeling, @food, @rating, @mood, @weather, @memory, @tags, @sequence
  )
`);

const seedDatabase = db.transaction(() => {
  const ordered = [...seedVisits].sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));

  ordered.forEach((visit, index) => {
    const [name, country, lat, lng] = visit.location;
    const [originName, originCountry, originLat, originLng] = visit.origin;

    const locationId = ensureLocation(db, { name, country, lat, lng, kind: 'city' });
    const originLocationId = ensureLocation(db, {
      name: originName,
      country: originCountry,
      lat: originLat,
      lng: originLng,
      kind: 'city'
    });

    insertVisit.run({
      locationId,
      originLocationId,
      returnsToOrigin: visit.returnsToOrigin === false ? 0 : 1,
      outboundTransport: visit.outboundTransport || 'flight',
      outboundNote: visit.outboundNote || '',
      returnTransport: null,
      returnNote: '',
      inboundTransport: visit.transport || null,
      inboundNote: visit.legNote || '',
      arrivedAt: visit.arrivedAt,
      departedAt: visit.departedAt,
      feeling: visit.feeling,
      food: visit.food,
      rating: visit.rating,
      mood: visit.mood,
      weather: visit.weather,
      memory: visit.memory,
      tags: visit.tags,
      sequence: index + 1
    });
  });

  rebuildSequencesAndLegs(db);
});

if ((db.prepare('SELECT COUNT(*) AS count FROM visits').get() as { count: number }).count === 0) {
  seedDatabase();
}

const allVisitRows = db.prepare(`
  SELECT
    visits.*,
    dest.name AS location_name,
    dest.country,
    dest.lat,
    dest.lng,
    dest.kind,
    orig.id AS origin_id,
    orig.name AS origin_name,
    orig.country AS origin_country,
    orig.lat AS origin_lat,
    orig.lng AS origin_lng,
    orig.kind AS origin_kind
  FROM visits
  JOIN locations dest ON dest.id = visits.location_id
  JOIN locations orig ON orig.id = visits.origin_location_id
  ORDER BY visits.sequence ASC, visits.arrived_at ASC, visits.id ASC
`);

const allLegRows = db.prepare(`
  SELECT *
  FROM legs
  ORDER BY sequence ASC
`);

const originSuggestionsQuery = db.prepare(`
  SELECT DISTINCT l.id, l.name, l.country, l.lat, l.lng, l.kind
  FROM locations l
  JOIN visits v ON v.origin_location_id = l.id
  ORDER BY l.name ASC
`);

function normalizeVisit(row: VisitRow) {
  return {
    id: row.id,
    arrivedAt: row.arrived_at,
    departedAt: row.departed_at,
    feeling: row.feeling,
    food: row.food,
    rating: row.rating,
    mood: row.mood,
    weather: row.weather,
    memory: row.memory,
    tags: row.tags,
    sequence: row.sequence,
    returnsToOrigin: Boolean(row.returns_to_origin),
    outboundTransport: row.outbound_transport,
    outboundNote: row.outbound_note,
    returnTransport: row.return_transport,
    returnNote: row.return_note,
    inboundTransport: row.inbound_transport,
    inboundNote: row.inbound_note,
    location: {
      id: row.location_id,
      name: row.location_name,
      country: row.country,
      lat: row.lat,
      lng: row.lng,
      kind: row.kind
    },
    origin: {
      id: row.origin_id,
      name: row.origin_name,
      country: row.origin_country,
      lat: row.origin_lat,
      lng: row.origin_lng,
      kind: row.origin_kind
    }
  };
}

function normalizeLeg(leg: LegRow) {
  return {
    id: leg.id,
    fromVisitId: leg.from_visit_id,
    toVisitId: leg.to_visit_id,
    transport: leg.transport,
    durationHours: leg.duration_hours,
    distanceKm: leg.distance_km,
    note: leg.note,
    sequence: leg.sequence
  };
}

export function getAtlas() {
  const visits = (allVisitRows.all() as VisitRow[]).map(normalizeVisit);
  const legs = (allLegRows.all() as LegRow[]).map(normalizeLeg);
  const visitRoutes = buildVisitRoutes(visits);
  const originSuggestions = originSuggestionsQuery.all() as {
    id: number;
    name: string;
    country: string;
    lat: number;
    lng: number;
    kind: string;
  }[];
  const yearNums = visits.map((visit) => visitYear(visit.arrivedAt)).filter(Number.isFinite);
  const yearSet = [...new Set(yearNums)].sort((a, b) => b - a);
  const countries = new Set(visits.map((visit) => visit.location.country));
  const ratings = visits.map((visit) => Number(visit.rating)).filter(Number.isFinite);

  return {
    visits,
    legs,
    visitRoutes,
    originSuggestions,
    years: yearSet,
    yearColors: buildYearColors(yearSet),
    stats: {
      visitCount: visits.length,
      countryCount: countries.size,
      averageRating:
        ratings.length > 0
          ? Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1))
          : 0,
      startYear: yearNums.length ? Math.min(...yearNums) : null,
      endYear: yearNums.length ? Math.max(...yearNums) : null
    }
  };
}

function cleanString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.trim();
}

function cleanNumber(value: unknown, fallback: number | null = null): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanRating(value: unknown): number {
  const rating = cleanNumber(value, 4.5) ?? 4.5;
  return Math.max(1, Math.min(5, Number(rating.toFixed(1))));
}

function requireText(payload: VisitPayloadInput, key: keyof VisitPayloadInput, label: string): string {
  const value = cleanString(payload[key]);
  if (!value) {
    throw httpError(400, `${label}不能为空`);
  }
  return value;
}

function readCoords(
  payload: VisitPayloadInput,
  prefix: '' | 'origin'
): { lat: number; lng: number; name: string; country: string } {
  const latKey = prefix ? 'originLat' : 'lat';
  const lngKey = prefix ? 'originLng' : 'lng';
  const nameKey = prefix ? 'originName' : 'locationName';
  const countryKey = prefix ? 'originCountry' : 'country';
  const lat = cleanNumber(payload[latKey]);
  const lng = cleanNumber(payload[lngKey]);
  if (lat === null || lat < -90 || lat > 90) {
    throw httpError(400, '纬度需要在 -90 到 90 之间');
  }
  if (lng === null || lng < -180 || lng > 180) {
    throw httpError(400, '经度需要在 -180 到 180 之间');
  }
  return {
    lat,
    lng,
    name: requireText(payload, nameKey, prefix ? '起点' : '地点'),
    country: requireText(payload, countryKey, prefix ? '起点国家/地区' : '国家/地区')
  };
}

function readVisitPayload(payload: VisitPayloadInput): ParsedVisitPayload {
  const destination = readCoords(payload, '');
  const origin = readCoords(payload, 'origin');

  if (destination.lat === origin.lat && destination.lng === origin.lng) {
    throw httpError(400, '起点与目的地不能相同');
  }

  const returnsToOrigin = payload.returnsToOrigin !== false;
  const arrivedAt = parseIsoDate(payload.arrivedAt, '到达时间');
  const departedRaw = typeof payload.departedAt === 'string' ? payload.departedAt.trim() : '';
  const departedAt = departedRaw ? parseIsoDate(departedRaw, '离开时间') : null;
  assertDateOrder(arrivedAt, departedAt);

  const outboundTransport = parseTransport(payload.outboundTransport, {
    label: '去程交通方式',
    fallback: 'flight'
  }) as string;

  const returnTransport = returnsToOrigin
    ? parseTransport(payload.returnTransport, { label: '返程交通方式', allowEmpty: true })
    : null;

  const inboundTransport = parseTransport(payload.inboundTransport, {
    label: '站间交通方式',
    allowEmpty: true
  });

  return {
    locationName: destination.name,
    country: destination.country,
    lat: destination.lat,
    lng: destination.lng,
    arrivedAt,
    departedAt,
    originName: origin.name,
    originCountry: origin.country,
    originLat: origin.lat,
    originLng: origin.lng,
    returnsToOrigin,
    outboundTransport,
    outboundNote: cleanString(payload.outboundNote),
    returnNote: cleanString(payload.returnNote),
    returnTransport,
    inboundTransport,
    inboundNote: cleanString(payload.inboundNote),
    feeling: cleanString(payload.feeling),
    food: cleanString(payload.food),
    rating: cleanRating(payload.rating),
    mood: cleanString(payload.mood),
    weather: cleanString(payload.weather),
    memory: cleanString(payload.memory),
    tags: cleanString(payload.tags)
  };
}

export const createVisit = db.transaction((rawPayload: VisitPayloadInput) => {
  const payload = readVisitPayload(rawPayload);

  const locationId = ensureLocation(db, {
    name: payload.locationName,
    country: payload.country,
    lat: payload.lat,
    lng: payload.lng,
    kind: 'city'
  });

  const originLocationId = ensureLocation(db, {
    name: payload.originName,
    country: payload.originCountry,
    lat: payload.originLat,
    lng: payload.originLng,
    kind: 'city'
  });

  const visitId = Number(
    insertVisit.run({
      locationId,
      originLocationId,
      returnsToOrigin: payload.returnsToOrigin ? 1 : 0,
      outboundTransport: payload.outboundTransport,
      outboundNote: payload.outboundNote,
      returnTransport: payload.returnTransport,
      returnNote: payload.returnNote,
      inboundTransport: payload.inboundTransport,
      inboundNote: payload.inboundNote,
      arrivedAt: payload.arrivedAt,
      departedAt: payload.departedAt,
      feeling: payload.feeling,
      food: payload.food,
      rating: payload.rating,
      mood: payload.mood,
      weather: payload.weather,
      memory: payload.memory,
      tags: payload.tags,
      sequence: 0
    }).lastInsertRowid
  );

  rebuildSequencesAndLegs(db, {
    focusVisitId: visitId,
    focusInboundTransport: payload.inboundTransport || 'flight',
    focusInboundNote: payload.inboundNote || ''
  });

  return { visitId };
});

export const updateVisit = db.transaction((visitId: number, rawPayload: VisitPayloadInput) => {
  const payload = readVisitPayload(rawPayload);
  const current = db.prepare('SELECT * FROM visits WHERE id = ?').get(visitId) as DbVisitRow | undefined;

  if (!current) {
    throw httpError(404, '旅行节点不存在');
  }

  const locationId = ensureLocation(db, {
    name: payload.locationName,
    country: payload.country,
    lat: payload.lat,
    lng: payload.lng,
    kind: 'city'
  });

  const originLocationId = ensureLocation(db, {
    name: payload.originName,
    country: payload.originCountry,
    lat: payload.originLat,
    lng: payload.originLng,
    kind: 'city'
  });

  db.prepare(
    `
      UPDATE visits
      SET
        location_id = @locationId,
        origin_location_id = @originLocationId,
        returns_to_origin = @returnsToOrigin,
        outbound_transport = @outboundTransport,
        outbound_note = @outboundNote,
        return_transport = @returnTransport,
        return_note = @returnNote,
        inbound_transport = @inboundTransport,
        inbound_note = @inboundNote,
        arrived_at = @arrivedAt,
        departed_at = @departedAt,
        feeling = @feeling,
        food = @food,
        rating = @rating,
        mood = @mood,
        weather = @weather,
        memory = @memory,
        tags = @tags,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @visitId
    `
  ).run({
    visitId,
    locationId,
    originLocationId,
    returnsToOrigin: payload.returnsToOrigin ? 1 : 0,
    outboundTransport: payload.outboundTransport,
    outboundNote: payload.outboundNote,
    returnTransport: payload.returnTransport,
    returnNote: payload.returnNote,
    inboundTransport: payload.inboundTransport,
    inboundNote: payload.inboundNote,
    arrivedAt: payload.arrivedAt,
    departedAt: payload.departedAt,
    feeling: payload.feeling,
    food: payload.food,
    rating: payload.rating,
    mood: payload.mood,
    weather: payload.weather,
    memory: payload.memory,
    tags: payload.tags
  });

  purgeOrphanLocations(db, [current.location_id, current.origin_location_id]);

  rebuildSequencesAndLegs(db, {
    focusVisitId: visitId,
    focusInboundTransport: payload.inboundTransport || 'flight',
    focusInboundNote: payload.inboundNote || ''
  });

  return { visitId };
});

export const deleteVisit = db.transaction((visitId: number) => {
  const current = db.prepare('SELECT * FROM visits WHERE id = ?').get(visitId) as DbVisitRow | undefined;

  if (!current) {
    throw httpError(404, '旅行节点不存在');
  }

  db.prepare('DELETE FROM legs WHERE from_visit_id = ? OR to_visit_id = ?').run(visitId, visitId);
  db.prepare('DELETE FROM visits WHERE id = ?').run(visitId);
  purgeOrphanLocations(db, [current.location_id, current.origin_location_id]);
  rebuildSequencesAndLegs(db);

  return { visitId };
});

/** One-shot backfill for DBs whose legs were written before distance_km was populated. */
function backfillLegDistancesIfNeeded() {
  const missing = db
    .prepare(`SELECT COUNT(*) AS count FROM legs WHERE distance_km IS NULL`)
    .get() as { count: number };
  if (missing.count > 0) {
    rebuildSequencesAndLegs(db);
  }
}

backfillLegDistancesIfNeeded();
