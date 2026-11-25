// Small shared helper used by every page: stores the JWT in
// localStorage, attaches it to requests, and redirects to the
// login page if a request comes back unauthorized.

const Auth = {
  getToken() { return localStorage.getItem('fb_token'); },
  getUser() {
    const raw = localStorage.getItem('fb_user');
    return raw ? JSON.parse(raw) : null;
  },
  setSession(token, user) {
    localStorage.setItem('fb_token', token);
    localStorage.setItem('fb_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('fb_token');
    localStorage.removeItem('fb_user');
  },
  requireRole(role) {
    const user = Auth.getUser();
    if (!user || !Auth.getToken()) {
      window.location.href = '/index.html';
      return null;
    }
    if (role && user.role !== role) {
      window.location.href = user.role === 'admin' ? '/admin.html' : '/student.html';
      return null;
    }
    return user;
  }
};

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = {};
  try { data = await res.json(); } catch (e) { /* no body */ }

  if (res.status === 401) {
    Auth.clear();
    window.location.href = '/index.html';
    throw new Error(data.error || 'Session expired.');
  }

  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong.');
  }

  return data;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function showNotice(el, message, isError = true) {
  el.textContent = message;
  el.style.display = message ? 'block' : 'none';
  el.className = 'notice' + (isError ? ' error' : '');
}
