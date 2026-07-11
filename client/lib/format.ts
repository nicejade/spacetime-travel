import type { Transport } from './types';

export const transports: { value: Transport; label: string }[] = [
  { value: 'flight', label: '飞行' },
  { value: 'train', label: '火车' },
  { value: 'ferry', label: '渡轮' },
  { value: 'drive', label: '自驾' },
  { value: 'bus', label: '巴士' },
  { value: 'walk', label: '步行' }
];

export const transportLabel = (value: string | null | undefined): string =>
  transports.find((item) => item.value === value)?.label || '抵达';

export const transportDash = (value: string | null | undefined): string => {
  if (value === 'flight') return '7 9';
  if (value === 'ferry') return '2 8';
  if (value === 'drive') return '14 5 2 5';
  if (value === 'walk') return '2 5';
  if (value === 'bus') return '10 4';
  return '';
};

export const transportClass = (value: string | null | undefined): string => {
  if (value === 'flight') return 'route-flight';
  if (value === 'train') return 'route-train';
  if (value === 'ferry') return 'route-ferry';
  if (value === 'drive') return 'route-drive';
  if (value === 'walk') return 'route-walk';
  return 'route-bus';
};

export function formatDate(value: string | null | undefined, options: { day?: boolean } = {}): string {
  if (!value) return '未记录';
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: options.day === false ? undefined : 'numeric'
  }).format(date);
}

export function formatMonth(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short'
  }).format(date);
}

export function ratingText(value: number | string | null | undefined): string {
  return `${Number(value || 0).toFixed(1)} / 5`;
}

export function splitTags(value: string | null | undefined): string[] {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** Format a kilometer distance for stats / UI. */
export function formatDistanceKm(km: number | null | undefined): string {
  if (typeof km !== 'number' || !Number.isFinite(km) || km <= 0) return '—';
  if (km >= 10000) return `${Math.round(km / 1000)}k km`;
  if (km >= 1000) return `${(km / 1000).toFixed(1)}k km`;
  return `${Math.round(km)} km`;
}
