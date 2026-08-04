import { httpError } from '../lib/httpError.js';
import { SCHEMA_VERSION } from '../db/migrations.js';
import type { VisitPayloadInput } from '../types.js';

export const EXPORT_FORMAT = 'spacetime-travel';

export interface ExportVisit extends VisitPayloadInput {
  locationName: string;
  country: string;
  lat: number;
  lng: number;
  arrivedAt: string;
  originName: string;
  originCountry: string;
  originLat: number;
  originLng: number;
}

export interface ExportDocument {
  format: typeof EXPORT_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  visits: ExportVisit[];
}

export function buildExportDocument(
  visits: ExportVisit[],
  exportedAt = new Date().toISOString()
): ExportDocument {
  return {
    format: EXPORT_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    visits
  };
}

export function parseExportDocument(raw: unknown): { schemaVersion: number; visits: VisitPayloadInput[] } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw httpError(400, '导入文件必须是 JSON 对象');
  }

  const doc = raw as Record<string, unknown>;

  if (doc.format !== EXPORT_FORMAT) {
    throw httpError(400, '无法识别的导出格式');
  }

  if (typeof doc.schemaVersion !== 'number' || !Number.isInteger(doc.schemaVersion)) {
    throw httpError(400, '缺少有效的 schemaVersion');
  }

  if (doc.schemaVersion < 1) {
    throw httpError(400, 'schemaVersion 无效');
  }

  if (doc.schemaVersion > SCHEMA_VERSION) {
    throw httpError(
      400,
      `导出文件的 schema 版本 ${doc.schemaVersion} 高于当前应用（${SCHEMA_VERSION}），请先升级应用`
    );
  }

  if (!Array.isArray(doc.visits)) {
    throw httpError(400, 'visits 必须是数组');
  }

  return {
    schemaVersion: doc.schemaVersion,
    visits: doc.visits as VisitPayloadInput[]
  };
}
