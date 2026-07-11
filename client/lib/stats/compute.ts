import { splitTags, transportLabel } from '$lib/format';
import type { Leg, Visit } from '$lib/types';
import { visitYear } from '$lib/years';
import type {
  BarItem,
  CountryRow,
  GeoDistribution,
  RatingAnalysis,
  RatingBucket,
  StatsKpi,
  StatsSnapshot,
  TagThemes,
  TimeTrend,
  TopRatedPlace
} from './types';

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function visitMonth(arrivedAt: string): number {
  return Number(String(arrivedAt).slice(5, 7));
}

function topBars(items: BarItem[], limit: number): BarItem[] {
  return [...items].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'zh-CN')).slice(0, limit);
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function computeKpi(visits: Visit[], legs: Leg[]): StatsKpi {
  const countries = new Set(visits.map((visit) => visit.location.country).filter(Boolean));
  const ratings = visits.map((visit) => visit.rating).filter((rating) => rating > 0);
  const years = visits.map((visit) => visitYear(visit.arrivedAt)).filter(Number.isFinite);

  let spanLabel = '—';
  if (years.length) {
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    spanLabel = minYear === maxYear ? String(minYear) : `${minYear} – ${maxYear}`;
  }

  const totalDistanceKm = legs.reduce((sum, leg) => {
    const km = leg.distanceKm;
    return sum + (typeof km === 'number' && Number.isFinite(km) ? km : 0);
  }, 0);

  return {
    visitCount: visits.length,
    countryCount: countries.size,
    averageRating: ratings.length
      ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
      : null,
    spanLabel,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10
  };
}

function computeTransportDistance(legs: Leg[]): BarItem[] {
  const byTransport = new Map<string, number>();
  for (const leg of legs) {
    const km = leg.distanceKm;
    if (typeof km !== 'number' || !Number.isFinite(km) || km <= 0) continue;
    const key = leg.transport || 'flight';
    byTransport.set(key, (byTransport.get(key) ?? 0) + km);
  }

  return [...byTransport.entries()]
    .map(([label, value]) => ({
      label: transportLabel(label),
      value: Math.round(value * 10) / 10
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'zh-CN'));
}

function computeTimeTrend(visits: Visit[], statsYear: number | 'all', yearColors: Record<string, string>): TimeTrend {
  if (visits.length === 0) {
    return { mode: statsYear === 'all' ? 'yearly' : 'monthly', bars: [], summary: '暂无旅行记录' };
  }

  if (statsYear === 'all') {
    const yearCounts = countBy(visits, (visit) => String(visitYear(visit.arrivedAt)));
    const bars = [...yearCounts.entries()]
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([label, value]) => ({
        label,
        value,
        color: yearColors[label] || '#2d7c89'
      }));

    const monthBuckets = new Map<string, number>();
    for (const visit of visits) {
      const year = visitYear(visit.arrivedAt);
      const month = visitMonth(visit.arrivedAt);
      const key = `${year}-${month}`;
      monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + 1);
    }
    let peakKey = '';
    let peakCount = 0;
    for (const [key, count] of monthBuckets) {
      if (count > peakCount) {
        peakCount = count;
        peakKey = key;
      }
    }
    const [peakYear, peakMonth] = peakKey.split('-').map(Number);
    const summary =
      peakKey && peakYear && peakMonth
        ? `${peakYear} 年 ${peakMonth} 月最活跃（${peakCount} 次）`
        : '暂无趋势摘要';

    return { mode: 'yearly', bars, summary };
  }

  const monthCounts = new Map<number, number>();
  for (let month = 1; month <= 12; month += 1) {
    monthCounts.set(month, 0);
  }
  for (const visit of visits) {
    const month = visitMonth(visit.arrivedAt);
    if (month >= 1 && month <= 12) {
      monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
    }
  }

  const color = yearColors[String(statsYear)] || '#2d7c89';
  const bars = [...monthCounts.entries()].map(([month, value]) => ({
    label: MONTH_LABELS[month - 1] ?? String(month),
    value,
    color
  }));

  let peakMonth = 1;
  let peakCount = 0;
  for (const [month, count] of monthCounts) {
    if (count > peakCount) {
      peakCount = count;
      peakMonth = month;
    }
  }
  const summary =
    peakCount > 0
      ? `${statsYear} 年 ${peakMonth} 月最活跃（${peakCount} 次）`
      : `${statsYear} 年暂无旅行记录`;

  return { mode: 'monthly', bars, summary };
}

function computeGeo(visits: Visit[]): GeoDistribution {
  const countryCounts = countBy(visits, (visit) => visit.location.country);
  const placeCounts = countBy(visits, (visit) => visit.location.name);

  const firstYearByCountry = new Map<string, number>();
  for (const visit of visits) {
    const country = visit.location.country;
    if (!country) continue;
    const year = visitYear(visit.arrivedAt);
    const existing = firstYearByCountry.get(country);
    if (existing === undefined || year < existing) {
      firstYearByCountry.set(country, year);
    }
  }

  const countries = topBars(
    [...countryCounts.entries()].map(([label, value]) => ({ label, value })),
    8
  );
  const places = topBars(
    [...placeCounts.entries()].map(([label, value]) => ({ label, value })),
    8
  );
  const table: CountryRow[] = [...countryCounts.entries()]
    .map(([country, count]) => ({
      country,
      count,
      firstYear: firstYearByCountry.get(country) ?? 0
    }))
    .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country, 'zh-CN'))
    .slice(0, 8);

  return { countries, places, table };
}

function computeRating(visits: Visit[], statsYear: number | 'all', yearColors: Record<string, string>): RatingAnalysis {
  const ratedVisits = visits.filter((visit) => visit.rating > 0);
  const totalRated = ratedVisits.length;

  const bucketCounts = new Map<number, number>();
  for (let star = 1; star <= 5; star += 1) {
    bucketCounts.set(star, 0);
  }
  for (const visit of ratedVisits) {
    const star = Math.max(1, Math.min(5, Math.round(visit.rating)));
    bucketCounts.set(star, (bucketCounts.get(star) ?? 0) + 1);
  }

  const buckets: RatingBucket[] = [...bucketCounts.entries()]
    .sort(([a], [b]) => b - a)
    .map(([star, count]) => ({
      star,
      count,
      percent: totalRated ? Math.round((count / totalRated) * 100) : 0
    }));

  const yearlyAverage: BarItem[] = [];
  if (statsYear === 'all') {
    const byYear = new Map<number, number[]>();
    for (const visit of ratedVisits) {
      const year = visitYear(visit.arrivedAt);
      const list = byYear.get(year) ?? [];
      list.push(visit.rating);
      byYear.set(year, list);
    }
    for (const [year, ratings] of [...byYear.entries()].sort(([a], [b]) => a - b)) {
      const avg = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
      yearlyAverage.push({
        label: String(year),
        value: Math.round(avg * 10) / 10,
        color: yearColors[String(year)] || '#2d7c89'
      });
    }
  }

  const topPlaces: TopRatedPlace[] = ratedVisits
    .filter((visit) => visit.rating >= 4)
    .sort((a, b) => b.rating - a.rating || a.location.name.localeCompare(b.location.name, 'zh-CN'))
    .slice(0, 5)
    .map((visit) => ({
      name: visit.location.name,
      country: visit.location.country,
      rating: visit.rating
    }));

  return {
    buckets,
    yearlyAverage,
    topPlaces,
    hasRatings: totalRated > 0
  };
}

function computeTags(visits: Visit[]): TagThemes {
  const tagCounts = new Map<string, number>();
  let totalMarks = 0;

  for (const visit of visits) {
    const tags = splitTags(visit.tags);
    totalMarks += tags.length;
    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const tags = topBars(
    [...tagCounts.entries()].map(([label, value]) => ({ label, value })),
    10
  );

  return {
    tags,
    uniqueCount: tagCounts.size,
    totalMarks
  };
}

export function filterLegsForVisits(legs: Leg[], visits: Visit[]): Leg[] {
  const visitIds = new Set(visits.map((visit) => visit.id));
  return legs.filter((leg) => visitIds.has(leg.fromVisitId) && visitIds.has(leg.toVisitId));
}

export function computeStatsSnapshot(
  visits: Visit[],
  statsYear: number | 'all',
  yearColors: Record<string, string> = {},
  legs: Leg[] = []
): StatsSnapshot {
  const scopedLegs = filterLegsForVisits(legs, visits);
  return {
    kpi: computeKpi(visits, scopedLegs),
    timeTrend: computeTimeTrend(visits, statsYear, yearColors),
    geo: computeGeo(visits),
    rating: computeRating(visits, statsYear, yearColors),
    tags: computeTags(visits),
    transportDistance: computeTransportDistance(scopedLegs),
    isEmpty: visits.length === 0
  };
}
