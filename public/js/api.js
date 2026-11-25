// Shared helpers for talking to the server and tracking who is logged in.
//
// The login session itself lives in an httpOnly cookie that page scripts
// cannot read. We only keep a copy of the (non-secret) user profile in
// sessionStorage so pages can render the header instantly.

class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields || null;
  }
}

async function api(path, { method = 'GET', body, redirectOn401 = true } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : (method === 'GET' ? undefined : '{}')
    });
  } catch (err) {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }

  let data = {};
  try { data = await res.json(); } catch (e) { /* empty body */ }

  if (res.status === 401 && redirectOn401) {
    const hadSession = Boolean(Session.cached()); // only say "expired" if we were logged in
    Session.forget();
    Session.redirectToLogin({ expired: hadSession });
    throw new ApiError(data.error || 'Please log in again.', 401);
  }

  if (!res.ok) {
    throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status, data.fields);
  }
  return data;
}

const Session = {
  KEY: 'fb_user',

  cached() {
    try {
      const raw = sessionStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },

  remember(user) {
    try { sessionStorage.setItem(this.KEY, JSON.stringify(user)); } catch (e) { /* ignore */ }
  },

  forget() {
    try { sessionStorage.removeItem(this.KEY); } catch (e) { /* ignore */ }
  },

  homeFor(user) {
    return user && user.role === 'admin' ? '/admin.html' : '/student.html';
  },

  redirectToLogin({ expired = false } = {}) {
    const here = window.location.pathname + window.location.search;
    const params = new URLSearchParams();
    if (here && here !== '/' && !here.startsWith('/index.html')) params.set('next', here);
    if (expired) params.set('expired', '1');
    const qs = params.toString();
    window.location.replace('/index.html' + (qs ? `?${qs}` : ''));
  },

  /** Only allow redirects to pages on this site (prevents open redirects). */
  safeNext(next) {
    if (typeof next !== 'string') return null;
    if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
    if (next.startsWith('/index.html') || next.startsWith('/api/')) return null;
    return next;
  },

  /** Confirms the session with the server. Redirects away if it's missing or the wrong role. */
  async require(role) {
    try {
      const { user } = await api('/auth/me');
      this.remember(user);
      if (role && user.role !== role) {
        window.location.replace(this.homeFor(user));
        return null;
      }
      return user;
    } catch (err) {
      if (err.status !== 401) {
        document.body.innerHTML = '';
        UI.fatal(err.message);
      }
      return null;
    }
  },

  async logout() {
    try { await api('/auth/logout', { method: 'POST', redirectOn401: false }); } catch (e) { /* still leave */ }
    this.forget();
    window.location.replace('/index.html?loggedout=1');
  }
};
