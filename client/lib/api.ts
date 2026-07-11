import type { ApiErrorBody, Atlas, VisitMutationResult, VisitPayload } from './types';

const jsonHeaders = {
  'Content-Type': 'application/json'
};

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as ApiErrorBody;

  if (!response.ok) {
    throw new Error(payload.error || '请求失败');
  }

  return payload as T;
}

export async function fetchAtlas(): Promise<Atlas> {
  return readJson<Atlas>(await fetch('/api/atlas'));
}

export interface ExportDocument {
  format: string;
  schemaVersion: number;
  exportedAt: string;
  visits: VisitPayload[];
}

export interface ImportResult {
  ok: boolean;
  visitCount: number;
  schemaVersion: number;
  atlas: Atlas;
}

export async function fetchExportDocument(): Promise<ExportDocument> {
  return readJson<ExportDocument>(await fetch('/api/export'));
}

export async function importAtlasDocument(document: unknown): Promise<ImportResult> {
  return readJson<ImportResult>(
    await fetch('/api/import', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(document)
    })
  );
}

export async function createVisit(payload: VisitPayload): Promise<VisitMutationResult> {
  return readJson<VisitMutationResult>(
    await fetch('/api/visits', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    })
  );
}

export async function updateVisit(id: number, payload: VisitPayload): Promise<VisitMutationResult> {
  return readJson<VisitMutationResult>(
    await fetch(`/api/visits/${id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    })
  );
}

export async function deleteVisit(id: number): Promise<VisitMutationResult> {
  return readJson<VisitMutationResult>(
    await fetch(`/api/visits/${id}`, {
      method: 'DELETE'
    })
  );
}
