import type { HttpError } from './types.js';

export const TRANSPORTS = ['flight', 'train', 'ferry', 'drive', 'bus', 'walk'] as const;
export type Transport = (typeof TRANSPORTS)[number];

function httpError(status: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  error.statusCode = status;
  return error;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw httpError(400, `${label}不能为空`);
  }
  const trimmed = value.trim();
  const match = ISO_DATE.exec(trimmed);
  if (!match) {
    throw httpError(400, `${label}格式无效，请使用 YYYY-MM-DD`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw httpError(400, `${label}格式无效，请使用 YYYY-MM-DD`);
  }
  return trimmed;
}

export function assertDateOrder(arrivedAt: string, departedAt: string | null): void {
  if (departedAt !== null && departedAt < arrivedAt) {
    throw httpError(400, '离开时间不能早于到达时间');
  }
}

export function isTransport(value: string): value is Transport {
  return (TRANSPORTS as readonly string[]).includes(value);
}

export function parseTransport(
  value: unknown,
  options: { label: string; fallback?: Transport; allowEmpty?: boolean }
): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    if (options.fallback !== undefined) return options.fallback;
    if (options.allowEmpty) return null;
    throw httpError(400, `${options.label}不能为空`);
  }
  if (!isTransport(raw)) {
    throw httpError(400, `${options.label}无效`);
  }
  return raw;
}

export function parseVisitId(raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw httpError(400, '访问 ID 无效');
  }
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw httpError(400, '访问 ID 无效');
  }
  return id;
}
