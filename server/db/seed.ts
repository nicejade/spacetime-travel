import type Database from 'better-sqlite3';
import { ensureLocation } from '../models/location.js';
import { rebuildSequencesAndLegs } from '../rebuildLegs.js';

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

export function seedIfEmpty(db: Database.Database): void {
  const count = (db.prepare('SELECT COUNT(*) AS count FROM visits').get() as { count: number }).count;
  if (count > 0) return;

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

  seedDatabase();
}
