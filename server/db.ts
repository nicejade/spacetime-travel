import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HttpError, ParsedVisitPayload, VisitPayloadInput } from './types.js';

function httpError(status: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
}

interface TripRow {
  id: number;
  title: string;
  subtitle: string;
  started_at: string | null;
  ended_at: string | null;
  color: string;
  notes: string;
}

interface LegRow {
  id: number;
  trip_id: number;
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
  trip_id: number;
  location_id: number;
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
  trip_id: number;
  location_id: number;
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
  inbound_transport: string | null;
  inbound_note: string | null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'spacetime-travel.sqlite');

fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subtitle TEXT DEFAULT '',
    started_at TEXT,
    ended_at TEXT,
    color TEXT NOT NULL DEFAULT '#2d7c89',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    kind TEXT DEFAULT 'city',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    location_id INTEGER NOT NULL,
    arrived_at TEXT NOT NULL,
    departed_at TEXT,
    feeling TEXT DEFAULT '',
    food TEXT DEFAULT '',
    rating REAL NOT NULL DEFAULT 4,
    mood TEXT DEFAULT '',
    weather TEXT DEFAULT '',
    memory TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    sequence INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS legs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    from_visit_id INTEGER NOT NULL,
    to_visit_id INTEGER NOT NULL,
    transport TEXT NOT NULL DEFAULT 'flight',
    duration_hours REAL,
    distance_km REAL,
    note TEXT DEFAULT '',
    sequence INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (from_visit_id) REFERENCES visits(id) ON DELETE CASCADE,
    FOREIGN KEY (to_visit_id) REFERENCES visits(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_visits_trip_sequence ON visits(trip_id, sequence);
  CREATE INDEX IF NOT EXISTS idx_legs_trip_sequence ON legs(trip_id, sequence);
`);

const seedTrips = [
  {
    title: '东亚春日线',
    subtitle: '樱花、雨声和慢慢亮起的街',
    color: '#dd6f5c',
    notes: '短途密集，适合重新找回出发的节奏。',
    visits: [
      {
        location: ['上海', '中国', 31.2304, 121.4737],
        arrivedAt: '2019-03-28',
        departedAt: '2019-03-30',
        feeling: '从熟悉的江边出发，心里有一种把日常轻轻折起来的感觉。',
        food: '葱油拌面、小笼、热豆浆',
        rating: 4.2,
        mood: '启程',
        weather: '阴转晴',
        memory: '行李很轻，计划也很轻。',
        tags: '出发,城市,春天'
      },
      {
        location: ['京都', '日本', 35.0116, 135.7681],
        arrivedAt: '2019-04-01',
        departedAt: '2019-04-06',
        transport: 'flight',
        legNote: '清晨航班落地大阪，再一路坐电车进京都。',
        feeling: '鸭川边的风把时间放慢，寺院的木香和雨后的石板路都很温柔。',
        food: '抹茶、汤豆腐、鲭鱼寿司',
        rating: 4.8,
        mood: '柔软',
        weather: '小雨',
        memory: '傍晚沿着鸭川走到灯亮。',
        tags: '樱花,寺院,慢旅行'
      },
      {
        location: ['首尔', '韩国', 37.5665, 126.978],
        arrivedAt: '2019-04-08',
        departedAt: '2019-04-12',
        transport: 'flight',
        legNote: '从关西飞往仁川，城市节奏忽然变快。',
        feeling: '山和高楼挤在一起，咖啡馆像很多临时停靠的小岛。',
        food: '参鸡汤、烤肉、冷面',
        rating: 4.4,
        mood: '清醒',
        weather: '晴',
        memory: '夜里从南山看整座城市。',
        tags: '夜景,咖啡,城市'
      }
    ]
  },
  {
    title: '欧陆慢火车',
    subtitle: '从海峡到大西洋的长线漫游',
    color: '#2d7c89',
    notes: '更多是停留和观看，而不是赶路。',
    visits: [
      {
        location: ['伊斯坦布尔', '土耳其', 41.0082, 28.9784],
        arrivedAt: '2022-09-06',
        departedAt: '2022-09-11',
        feeling: '海峡两岸的风把东西方缝在一起，轮渡声像一天的标点。',
        food: '烤鱼三明治、土耳其红茶、开心果甜点',
        rating: 4.7,
        mood: '辽阔',
        weather: '晴热',
        memory: '坐轮渡横过博斯普鲁斯海峡。',
        tags: '海峡,集市,轮渡'
      },
      {
        location: ['雅典', '希腊', 37.9838, 23.7275],
        arrivedAt: '2022-09-14',
        departedAt: '2022-09-18',
        transport: 'ferry',
        legNote: '一段海上移动，像把地图摊在风里。',
        feeling: '白色街巷和强烈日光让每个转角都显得直接。',
        food: '烤羊肉、希腊酸奶、橄榄',
        rating: 4.3,
        mood: '明亮',
        weather: '晴',
        memory: '黄昏时卫城的石头变成蜂蜜色。',
        tags: '遗迹,海风,日落'
      },
      {
        location: ['罗马', '意大利', 41.9028, 12.4964],
        arrivedAt: '2022-09-21',
        departedAt: '2022-09-26',
        transport: 'flight',
        legNote: '短飞抵达，下一段改用火车。',
        feeling: '古老和日常没有边界，喷泉边的聊天声也像历史的一部分。',
        food: 'Carbonara、Gelato、浓缩咖啡',
        rating: 4.6,
        mood: '饱满',
        weather: '晴',
        memory: '夜里走过万神殿前的小广场。',
        tags: '古城,美食,步行'
      },
      {
        location: ['巴黎', '法国', 48.8566, 2.3522],
        arrivedAt: '2022-09-28',
        departedAt: '2022-10-04',
        transport: 'train',
        legNote: '沿欧洲铁路北上，窗外的光线越来越凉。',
        feeling: '它比想象中更日常，也更私人；桥、河和书店让人愿意多停几天。',
        food: '可颂、洋葱汤、鸭胸',
        rating: 4.5,
        mood: '松弛',
        weather: '多云',
        memory: '塞纳河边的长椅和一本没读完的书。',
        tags: '博物馆,河岸,书店'
      },
      {
        location: ['里斯本', '葡萄牙', 38.7223, -9.1393],
        arrivedAt: '2022-10-07',
        departedAt: '2022-10-13',
        transport: 'train',
        legNote: '西行到海边，结束在电车和坡道之间。',
        feeling: '坡道、瓷砖和大西洋的光都带着一点旧电影的颗粒感。',
        food: '蛋挞、海鲜饭、鳕鱼球',
        rating: 4.9,
        mood: '眷恋',
        weather: '晴有风',
        memory: '黄昏在阿尔法玛区听到一小段法朵。',
        tags: '海边,坡道,音乐'
      }
    ]
  },
  {
    title: '南半球长夏',
    subtitle: '跨过赤道，把夏天延长',
    color: '#6d8f58',
    notes: '这一段像一次很长的换气。',
    visits: [
      {
        location: ['开普敦', '南非', -33.9249, 18.4241],
        arrivedAt: '2024-01-09',
        departedAt: '2024-01-15',
        feeling: '桌山压着海风，城市边缘有一种开阔又锋利的美。',
        food: '海鲜、Bobotie、Rooibos 茶',
        rating: 4.4,
        mood: '开阔',
        weather: '晴风大',
        memory: '日落时海面像一块很冷的银。',
        tags: '海岸,山,夏天'
      },
      {
        location: ['布宜诺斯艾利斯', '阿根廷', -34.6037, -58.3816],
        arrivedAt: '2024-01-20',
        departedAt: '2024-01-27',
        transport: 'flight',
        legNote: '跨过南大西洋，时间感被航程拉长。',
        feeling: '街道有音乐和树影，很多下午都像被探戈拖慢了一拍。',
        food: '牛排、Empanadas、Malbec',
        rating: 4.6,
        mood: '热烈',
        weather: '炎热',
        memory: '在 San Telmo 的旧市场里看人跳舞。',
        tags: '探戈,市场,树影'
      },
      {
        location: ['库斯科', '秘鲁', -13.5319, -71.9675],
        arrivedAt: '2024-02-01',
        departedAt: '2024-02-07',
        transport: 'flight',
        legNote: '飞进安第斯，高海拔让脚步自然变慢。',
        feeling: '空气薄，天空近，石墙像把许多世纪都留在手边。',
        food: '藜麦汤、烤豚鼠、古柯茶',
        rating: 4.7,
        mood: '敬畏',
        weather: '多云阵雨',
        memory: '清晨爬坡时听见远处的钟声。',
        tags: '高原,遗迹,徒步'
      },
      {
        location: ['墨西哥城', '墨西哥', 19.4326, -99.1332],
        arrivedAt: '2024-02-11',
        departedAt: '2024-02-18',
        transport: 'flight',
        legNote: '北上到高原都市，颜色和声音密度都变高。',
        feeling: '街头食物、壁画和市场让城市像一本很厚的手账。',
        food: 'Tacos al pastor、Mole、玉米粥',
        rating: 4.8,
        mood: '丰盛',
        weather: '晴',
        memory: '在 Coyoacan 的蓝墙边慢慢散步。',
        tags: '街食,壁画,市场'
      }
    ]
  }
];

const insertTrip = db.prepare(`
  INSERT INTO trips (title, subtitle, started_at, ended_at, color, notes)
  VALUES (@title, @subtitle, @startedAt, @endedAt, @color, @notes)
`);

const insertLocation = db.prepare(`
  INSERT INTO locations (name, country, lat, lng, kind)
  VALUES (@name, @country, @lat, @lng, @kind)
`);

const insertVisit = db.prepare(`
  INSERT INTO visits (
    trip_id, location_id, arrived_at, departed_at, feeling, food, rating,
    mood, weather, memory, tags, sequence
  )
  VALUES (
    @tripId, @locationId, @arrivedAt, @departedAt, @feeling, @food, @rating,
    @mood, @weather, @memory, @tags, @sequence
  )
`);

const insertLeg = db.prepare(`
  INSERT INTO legs (
    trip_id, from_visit_id, to_visit_id, transport, duration_hours,
    distance_km, note, sequence
  )
  VALUES (
    @tripId, @fromVisitId, @toVisitId, @transport, @durationHours,
    @distanceKm, @note, @sequence
  )
`);

const seedDatabase = db.transaction(() => {
  for (const trip of seedTrips) {
    const tripId = Number(
      insertTrip.run({
        title: trip.title,
        subtitle: trip.subtitle,
        startedAt: trip.visits[0]?.arrivedAt,
        endedAt: trip.visits.at(-1)?.departedAt,
        color: trip.color,
        notes: trip.notes
      }).lastInsertRowid
    );

    let previousVisitId: number | null = null;

    trip.visits.forEach((visit, index) => {
      const [name, country, lat, lng] = visit.location;
      const locationId = Number(
        insertLocation.run({
          name,
          country,
          lat,
          lng,
          kind: 'city'
        }).lastInsertRowid
      );

      const visitId = Number(
        insertVisit.run({
          tripId,
          locationId,
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
        }).lastInsertRowid
      );

      if (previousVisitId) {
        insertLeg.run({
          tripId,
          fromVisitId: previousVisitId,
          toVisitId: visitId,
          transport: visit.transport || 'flight',
          durationHours: null,
          distanceKm: null,
          note: visit.legNote || '',
          sequence: index
        });
      }

      previousVisitId = visitId;
    });
  }
});

if ((db.prepare('SELECT COUNT(*) AS count FROM trips').get() as { count: number }).count === 0) {
  seedDatabase();
}

const visitRowsByTrip = db.prepare(`
  SELECT
    visits.*,
    locations.name AS location_name,
    locations.country,
    locations.lat,
    locations.lng,
    locations.kind,
    inbound.transport AS inbound_transport,
    inbound.note AS inbound_note
  FROM visits
  JOIN locations ON locations.id = visits.location_id
  LEFT JOIN legs inbound ON inbound.to_visit_id = visits.id
  WHERE visits.trip_id = ?
  ORDER BY visits.sequence ASC, visits.arrived_at ASC
`);

const legRowsByTrip = db.prepare(`
  SELECT *
  FROM legs
  WHERE trip_id = ?
  ORDER BY sequence ASC
`);

const normalizeTrip = (trip: TripRow) => ({
  id: trip.id,
  title: trip.title,
  subtitle: trip.subtitle,
  startedAt: trip.started_at,
  endedAt: trip.ended_at,
  color: trip.color,
  notes: trip.notes,
  visits: (visitRowsByTrip.all(trip.id) as VisitRow[]).map(normalizeVisit),
  legs: (legRowsByTrip.all(trip.id) as LegRow[]).map((leg) => ({
    id: leg.id,
    tripId: leg.trip_id,
    fromVisitId: leg.from_visit_id,
    toVisitId: leg.to_visit_id,
    transport: leg.transport,
    durationHours: leg.duration_hours,
    distanceKm: leg.distance_km,
    note: leg.note,
    sequence: leg.sequence
  }))
});

function normalizeVisit(row: VisitRow) {
  return {
    id: row.id,
    tripId: row.trip_id,
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
    transport: row.inbound_transport,
    legNote: row.inbound_note,
    location: {
      id: row.location_id,
      name: row.location_name,
      country: row.country,
      lat: row.lat,
      lng: row.lng,
      kind: row.kind
    }
  };
}

export function getAtlas() {
  const trips = (db.prepare('SELECT * FROM trips ORDER BY started_at ASC, id ASC').all() as TripRow[]).map(
    normalizeTrip
  );
  const visits = trips.flatMap((trip) => trip.visits);
  const countries = new Set(visits.map((visit) => visit.location.country));
  const ratings = visits.map((visit) => Number(visit.rating)).filter(Number.isFinite);
  const years = visits.map((visit) => Number(visit.arrivedAt.slice(0, 4))).filter(Number.isFinite);

  return {
    trips,
    stats: {
      tripCount: trips.length,
      visitCount: visits.length,
      countryCount: countries.size,
      averageRating:
        ratings.length > 0
          ? Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1))
          : 0,
      startYear: years.length ? Math.min(...years) : null,
      endYear: years.length ? Math.max(...years) : null
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
  const rating = cleanNumber(value, 4) ?? 4;
  return Math.max(1, Math.min(5, Number(rating.toFixed(1))));
}

function requireText(payload: VisitPayloadInput, key: keyof VisitPayloadInput, label: string): string {
  const value = cleanString(payload[key]);
  if (!value) {
    throw httpError(400, `${label}不能为空`);
  }
  return value;
}

function readVisitPayload(payload: VisitPayloadInput): ParsedVisitPayload {
  const lat = cleanNumber(payload.lat);
  const lng = cleanNumber(payload.lng);

  if (lat === null || lat < -90 || lat > 90) {
    throw httpError(400, '纬度需要在 -90 到 90 之间');
  }

  if (lng === null || lng < -180 || lng > 180) {
    throw httpError(400, '经度需要在 -180 到 180 之间');
  }

  return {
    tripId: payload.tripId === 'new' ? 'new' : cleanNumber(payload.tripId),
    newTripTitle: cleanString(payload.newTripTitle),
    newTripSubtitle: cleanString(payload.newTripSubtitle),
    tripColor: cleanString(payload.tripColor, '#2d7c89'),
    locationName: requireText(payload, 'locationName', '地点'),
    country: requireText(payload, 'country', '国家/地区'),
    lat,
    lng,
    arrivedAt: requireText(payload, 'arrivedAt', '到达时间'),
    departedAt: cleanString(payload.departedAt) || null,
    transport: cleanString(payload.transport, 'flight'),
    legNote: cleanString(payload.legNote),
    feeling: cleanString(payload.feeling),
    food: cleanString(payload.food),
    rating: cleanRating(payload.rating),
    mood: cleanString(payload.mood),
    weather: cleanString(payload.weather),
    memory: cleanString(payload.memory),
    tags: cleanString(payload.tags)
  };
}

function updateTripDates(tripId: number) {
  const dates = db
    .prepare(
      `
      SELECT
        MIN(arrived_at) AS started_at,
        MAX(COALESCE(departed_at, arrived_at)) AS ended_at
      FROM visits
      WHERE trip_id = ?
    `
    )
    .get(tripId) as { started_at: string; ended_at: string } | undefined;

  if (!dates) return;

  db.prepare(
    `
      UPDATE trips
      SET started_at = ?, ended_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
  ).run(dates.started_at, dates.ended_at, tripId);
}

function createTripForPayload(payload: ParsedVisitPayload) {
  const title = payload.newTripTitle || `${payload.locationName} 的旅行`;
  return Number(
    insertTrip.run({
      title,
      subtitle: payload.newTripSubtitle,
      startedAt: payload.arrivedAt,
      endedAt: payload.departedAt || payload.arrivedAt,
      color: payload.tripColor,
      notes: ''
    }).lastInsertRowid
  );
}

export const createVisit = db.transaction((rawPayload: VisitPayloadInput) => {
  const payload = readVisitPayload(rawPayload);
  const existingTrip =
    payload.tripId && payload.tripId !== 'new'
      ? (db.prepare('SELECT * FROM trips WHERE id = ?').get(payload.tripId) as TripRow | undefined)
      : null;
  const tripId = existingTrip ? existingTrip.id : createTripForPayload(payload);

  const previousVisit = db
    .prepare('SELECT * FROM visits WHERE trip_id = ? ORDER BY sequence DESC LIMIT 1')
    .get(tripId) as DbVisitRow | undefined;
  const nextSequence = previousVisit ? previousVisit.sequence + 1 : 1;

  const locationId = Number(
    insertLocation.run({
      name: payload.locationName,
      country: payload.country,
      lat: payload.lat,
      lng: payload.lng,
      kind: 'city'
    }).lastInsertRowid
  );

  const visitId = Number(
    insertVisit.run({
      tripId,
      locationId,
      arrivedAt: payload.arrivedAt,
      departedAt: payload.departedAt,
      feeling: payload.feeling,
      food: payload.food,
      rating: payload.rating,
      mood: payload.mood,
      weather: payload.weather,
      memory: payload.memory,
      tags: payload.tags,
      sequence: nextSequence
    }).lastInsertRowid
  );

  if (previousVisit) {
    insertLeg.run({
      tripId,
      fromVisitId: previousVisit.id,
      toVisitId: visitId,
      transport: payload.transport,
      durationHours: null,
      distanceKm: null,
      note: payload.legNote,
      sequence: nextSequence - 1
    });
  }

  updateTripDates(tripId);
  return { visitId, tripId };
});

export const updateVisit = db.transaction((visitId: number, rawPayload: VisitPayloadInput) => {
  const payload = readVisitPayload(rawPayload);
  const current = db.prepare('SELECT * FROM visits WHERE id = ?').get(visitId) as DbVisitRow | undefined;

  if (!current) {
    throw httpError(404, '旅行节点不存在');
  }

  db.prepare(
    `
      UPDATE locations
      SET name = @name, country = @country, lat = @lat, lng = @lng
      WHERE id = @id
    `
  ).run({
    id: current.location_id,
    name: payload.locationName,
    country: payload.country,
    lat: payload.lat,
    lng: payload.lng
  });

  db.prepare(
    `
      UPDATE visits
      SET
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

  const previousVisit = db
    .prepare('SELECT * FROM visits WHERE trip_id = ? AND sequence < ? ORDER BY sequence DESC LIMIT 1')
    .get(current.trip_id, current.sequence) as DbVisitRow | undefined;
  const incomingLeg = db.prepare('SELECT * FROM legs WHERE to_visit_id = ?').get(visitId) as LegRow | undefined;

  if (previousVisit && incomingLeg) {
    db.prepare(
      `
        UPDATE legs
        SET transport = ?, note = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
    ).run(payload.transport, payload.legNote, incomingLeg.id);
  } else if (previousVisit) {
    insertLeg.run({
      tripId: current.trip_id,
      fromVisitId: previousVisit.id,
      toVisitId: visitId,
      transport: payload.transport,
      durationHours: null,
      distanceKm: null,
      note: payload.legNote,
      sequence: current.sequence - 1
    });
  }

  updateTripDates(current.trip_id);
  return { visitId, tripId: current.trip_id };
});

function resequenceTrip(tripId: number) {
  const visits = db
    .prepare('SELECT id FROM visits WHERE trip_id = ? ORDER BY sequence ASC, arrived_at ASC')
    .all(tripId) as { id: number }[];

  visits.forEach((visit, index) => {
    db.prepare('UPDATE visits SET sequence = ? WHERE id = ?').run(index + 1, visit.id);
  });

  const legs = db
    .prepare('SELECT id FROM legs WHERE trip_id = ? ORDER BY sequence ASC')
    .all(tripId) as { id: number }[];

  legs.forEach((leg, index) => {
    db.prepare('UPDATE legs SET sequence = ? WHERE id = ?').run(index + 1, leg.id);
  });
}

export const deleteVisit = db.transaction((visitId: number) => {
  const current = db.prepare('SELECT * FROM visits WHERE id = ?').get(visitId) as DbVisitRow | undefined;

  if (!current) {
    throw httpError(404, '旅行节点不存在');
  }

  db.prepare('DELETE FROM legs WHERE from_visit_id = ? OR to_visit_id = ?').run(visitId, visitId);
  db.prepare('DELETE FROM visits WHERE id = ?').run(visitId);

  const remaining = db
    .prepare('SELECT COUNT(*) AS count FROM visits WHERE trip_id = ?')
    .get(current.trip_id) as { count: number };
  if (remaining.count === 0) {
    db.prepare('DELETE FROM trips WHERE id = ?').run(current.trip_id);
  } else {
    resequenceTrip(current.trip_id);
    updateTripDates(current.trip_id);
  }

  return { visitId, tripId: current.trip_id };
});
