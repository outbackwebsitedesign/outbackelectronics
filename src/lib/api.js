import { useState, useEffect } from 'react';

// ── Same-origin CSRF ──────────────────────────────────────────────────────────

export function getCsrf() {
  return document.cookie.split(';').reduce((v, c) => {
    const [k, val] = c.trim().split('=');
    return k === '_csrf' ? decodeURIComponent(val || '') : v;
  }, '');
}

let _csrfReady = null;
export function ensureCsrf() {
  if (!_csrfReady) _csrfReady = fetch('/api/csrf-token', { credentials: 'include' }).catch(() => {});
  return _csrfReady;
}

// ── Cross-origin portal API helpers ──────────────────────────────────────────
// Call once per bundle: const { portalApi, usePortalUser } = makePortalHelpers(getPortalUrl)
// getPortalUrl is called lazily so runtime URL updates (from /api/config) take effect.
export function makePortalHelpers(getPortalUrl) {
  let _portalCsrfPromise = null;

  async function getPortalCsrf() {
    if (!_portalCsrfPromise) {
      _portalCsrfPromise = fetch(getPortalUrl() + '/api/csrf-token', { credentials: 'include' })
        .then(r => r.json()).then(d => d.token || '').catch(() => { _portalCsrfPromise = null; return ''; });
    }
    return _portalCsrfPromise;
  }

  async function portalApi(path, opts = {}) {
    const isPost = opts.method && opts.method.toUpperCase() !== 'GET';
    const csrfToken = isPost ? await getPortalCsrf() : '';
    const headers = { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) };
    return fetch(getPortalUrl() + path, { headers, credentials: 'include', ...opts })
      .then(async r => { const body = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, ...body }; });
  }

  // Returns [user, setUser] so callers that need to imperatively update auth state (e.g. after login) can do so.
  function usePortalUser() {
    const [user, setUser] = useState(undefined);
    useEffect(() => {
      fetch(getPortalUrl() + '/api/portal/auth/me', { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(d => setUser(d?.user || null))
        .catch(() => setUser(null));
    }, []);
    return [user, setUser];
  }

  return { portalApi, usePortalUser };
}
