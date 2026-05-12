// Portal API client — attaches PORTAL_SECRET from localStorage on every request.
// Token stored once on first login. If no PORTAL_SECRET set server-side, requests pass without token.

export function getToken() {
  try { return localStorage.getItem('portal_token') || ''; }
  catch { return ''; }
}

export function setToken(t) {
  localStorage.setItem('portal_token', t);
}

export function clearToken() {
  localStorage.removeItem('portal_token');
}

async function jget(url) {
  const r = await fetch(url, {
    headers: { 'X-Portal-Token': getToken() },
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent('portal-unauth'));
    throw new Error('Unauthorized — re-enter portal token');
  }
  if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

async function jsend(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Portal-Token': getToken(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent('portal-unauth'));
    throw new Error('Unauthorized — re-enter portal token');
  }
  if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

export const api = {
  // Desk
  getItems:   ({ today = true, limit = 200, processed = false } = {}) =>
    jget(`/api/desk/items?today=${today}&limit=${limit}&processed=${processed}`),
  patchItem:  (id, body) => jsend('PATCH', `/api/desk/items/${id}`, body),

  // Stories
  listStories:  () => jget('/api/stories'),
  getStory:     (id) => jget(`/api/stories/${id}`),
  storyItems:   (id) => jget(`/api/stories/${id}/items`),
  createStory:  (body) => jsend('POST', '/api/stories', body),
  updateStory:  (id, body) => jsend('PATCH', `/api/stories/${id}`, body),
  archiveStory: (id) => jsend('DELETE', `/api/stories/${id}`),
  refreshStory: (id) => jsend('POST', `/api/stories/${id}/refresh`),
  assign:       (storyId, itemId) => jsend('POST', `/api/stories/${storyId}/assign`, { itemId }),
  unassign:     (itemId) => jsend('POST', `/api/stories/unassign`, { itemId }),

  // Wall
  getWall:      () => jget('/api/wall'),
  toggleBasket: (id, in_basket) => jsend('PATCH', `/api/wall/${id}/basket`, { in_basket }),

  // L2 context (Gemini semantic framing of og_description)
  getL2: (id, og_description) => jsend('POST', `/api/desk/items/${id}/l2`, { og_description }),

  // Search
  search: (q, { limit = 20 } = {}) => jget(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  searchStatus: () => jget('/api/search/status'),
};
