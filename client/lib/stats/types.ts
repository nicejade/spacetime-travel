export interface BarItem {
  label: string;
  value: number;
  color?: string;
}

export interface StatsKpi {
  visitCount: number;
  countryCount: number;
  averageRating: number | null;
  spanLabel: string;
}

export interface CountryRow {
  country: string;
  count: number;
  firstYear: number;
}

export interface RatingBucket {
  star: number;
  count: number;
  percent: number;
}

export interface TopRatedPlace {
  name: string;
  country: string;
  rating: number;
}

export interface TimeTrend {
  mode: 'yearly' | 'monthly';
  bars: BarItem[];
  summary: string;
}

export interface GeoDistribution {
  countries: BarItem[];
  places: BarItem[];
  table: CountryRow[];
}

export interface RatingAnalysis {
  buckets: RatingBucket[];
  yearlyAverage: BarItem[];
  topPlaces: TopRatedPlace[];
  hasRatings: boolean;
}

export interface TagThemes {
  tags: BarItem[];
  uniqueCount: number;
  totalMarks: number;
}

export interface StatsSnapshot {
  kpi: StatsKpi;
  timeTrend: TimeTrend;
  geo: GeoDistribution;
  rating: RatingAnalysis;
  tags: TagThemes;
  isEmpty: boolean;
}
