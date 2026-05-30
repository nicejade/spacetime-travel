const jsonHeaders = {
  'Content-Type': 'application/json'
};

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || '请求失败');
  }

  return payload;
}

export async function fetchAtlas() {
  return readJson(await fetch('/api/atlas'));
}

export async function createVisit(payload) {
  return readJson(
    await fetch('/api/visits', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    })
  );
}

export async function updateVisit(id, payload) {
  return readJson(
    await fetch(`/api/visits/${id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    })
  );
}

export async function deleteVisit(id) {
  return readJson(
    await fetch(`/api/visits/${id}`, {
      method: 'DELETE'
    })
  );
}
