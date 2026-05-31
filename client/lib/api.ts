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
