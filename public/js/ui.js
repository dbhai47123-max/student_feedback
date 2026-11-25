// Small UI kit shared by every page: icons, header, toasts, confirm dialog,
// button loading states, inline field errors and formatting helpers.

const UI = (() => {
  const ICONS = {
    logo: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8"/><path d="M8 13h5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    'check-circle': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    circle: '<circle cx="12" cy="12" r="9"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'arrow-up': '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    'arrow-down': '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/>',
    file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    list: '<path d="M9 6h12"/><path d="M9 12h12"/><path d="M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    text: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
    printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 3v4"/><path d="M21 5h-4"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'
  };

  function icon(name, { size, className = '', label } = {}) {
    const body = ICONS[name] || ICONS.circle;
    const dims = size ? ` width="${size}" height="${size}"` : '';
    const a11y = label ? `role="img" aria-label="${escapeHtml(label)}"` : 'aria-hidden="true"';
    return `<svg class="icon ${className}"${dims} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${a11y} focusable="false">${body}</svg>`;
  }

  /**
   * Turns <span data-icon="name"></span> placeholders in static HTML into SVGs.
   * A bare <span> is replaced by the icon; an element with its own class keeps
   * its box and gets the icon inside it.
   */
  function hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach(el => {
      const svg = icon(el.getAttribute('data-icon'));
      if (el.tagName === 'SPAN' && !el.className) el.outerHTML = svg;
      else { el.innerHTML = svg; el.removeAttribute('data-icon'); }
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ------------------------------------------------------------ formatting

  function plural(n, word, pluralWord) {
    return `${n.toLocaleString()} ${n === 1 ? word : (pluralWord || word + 's')}`;
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = Array.from(parts[0])[0] || '';
    const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : '';
    return (first + last).toUpperCase();
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function timeAgo(iso) {
    if (!iso) return '';
    const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 45) return 'just now';
    const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unit, secs] of units) {
      const value = Math.floor(seconds / secs);
      if (value >= 1) return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
    }
    return 'just now';
  }

  /** Rough completion time: ~15s per rating/choice question, ~60s per written answer. */
  function estimateMinutes(questions) {
    const seconds = (questions || []).reduce((sum, q) => sum + (q.type === 'text' ? 60 : 15), 0);
    return Math.max(1, Math.round(seconds / 60));
  }

  function debounce(fn, wait = 200) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }

  // ------------------------------------------------------------ theme

  function currentTheme() {
    const set = document.documentElement.getAttribute('data-theme');
    if (set === 'light' || set === 'dark') return set;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function themeButtonHtml() {
    const dark = currentTheme() === 'dark';
    return `<button type="button" class="btn btn--ghost btn--icon" data-theme-toggle aria-label="Switch to ${dark ? 'light' : 'dark'} theme" title="Switch to ${dark ? 'light' : 'dark'} theme">${icon(dark ? 'sun' : 'moon')}</button>`;
  }

  function bindThemeToggles(root = document) {
    root.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const next = currentTheme() === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('fb_theme', next); } catch (e) { /* ignore */ }
        btn.outerHTML = themeButtonHtml();
        bindThemeToggles(root);
      });
    });
  }

  // ------------------------------------------------------------ header

  function renderHeader(user) {
    const mount = document.getElementById('app-header');
    if (!mount) return;
    const home = Session.homeFor(user);
    const area = user.role === 'admin' ? 'Admin console' : 'Student portal';
    mount.innerHTML = `
      <header class="app-header">
        <div class="container app-header__inner">
          <a class="brand" href="${home}" aria-label="KDU Feedback home">
            <span class="brand__logo">${icon('logo')}</span>
            <span class="brand__text"><strong>KDU Feedback</strong><small>${area}</small></span>
          </a>
          <div class="app-header__actions">
            ${themeButtonHtml()}
            <div class="user-menu">
              <button type="button" class="user-menu__trigger" aria-haspopup="true" aria-expanded="false" aria-controls="user-menu-panel">
                <span class="avatar" aria-hidden="true">${escapeHtml(initials(user.name))}</span>
                <span class="user-menu__who"><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.role)}</small></span>
                ${icon('chevron-down')}
                <span class="sr-only">Account menu</span>
              </button>
              <div class="user-menu__panel" id="user-menu-panel" hidden>
                <div class="user-menu__info">
                  <strong>${escapeHtml(user.name)}</strong>
                  <span>${escapeHtml(user.email)}</span>
                </div>
                <button type="button" class="menu-item menu-item--danger" data-action="logout">${icon('logout')} Log out</button>
              </div>
            </div>
          </div>
        </div>
      </header>`;

    bindThemeToggles(mount);

    const trigger = mount.querySelector('.user-menu__trigger');
    const panel = mount.querySelector('.user-menu__panel');
    const setOpen = open => {
      panel.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
      if (open) panel.querySelector('button').focus();
    };
    trigger.addEventListener('click', e => { e.stopPropagation(); setOpen(panel.hidden); });
    document.addEventListener('click', e => { if (!panel.hidden && !panel.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !panel.hidden) { setOpen(false); trigger.focus(); }
    });
    panel.querySelector('[data-action="logout"]').addEventListener('click', async e => {
      setLoading(e.currentTarget, true, 'Logging out…');
      await Session.logout();
    });
  }

  // ------------------------------------------------------------ toasts

  let toastRegion = null;
  function toast(message, { type = 'success', duration = 4500 } = {}) {
    if (!toastRegion) {
      toastRegion = document.createElement('div');
      toastRegion.className = 'toast-region';
      toastRegion.setAttribute('role', 'status');
      toastRegion.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastRegion);
    }
    const iconName = type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check-circle';
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `${icon(iconName)}<div class="toast__msg"></div><button type="button" class="toast__close" aria-label="Dismiss">${icon('x', { size: 16 })}</button>`;
    el.querySelector('.toast__msg').textContent = message;
    const remove = () => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 180);
    };
    el.querySelector('.toast__close').addEventListener('click', remove);
    toastRegion.appendChild(el);
    if (duration) setTimeout(remove, duration);
  }

  // ------------------------------------------------------------ dialog

  function confirm({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false, iconName } = {}) {
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.className = 'modal';
      dialog.setAttribute('aria-labelledby', 'modal-title');
      dialog.setAttribute('aria-describedby', 'modal-desc');
      dialog.innerHTML = `
        <form method="dialog">
          <div class="modal__body">
            <div class="modal__icon ${danger ? 'modal__icon--danger' : ''}">${icon(iconName || (danger ? 'warning' : 'info'), { size: 22 })}</div>
            <div>
              <h2 id="modal-title"></h2>
              <p id="modal-desc"></p>
            </div>
          </div>
          <div class="modal__foot">
            <button class="btn btn--secondary" value="cancel">${escapeHtml(cancelText)}</button>
            <button class="btn ${danger ? 'btn--danger' : ''}" value="confirm">${escapeHtml(confirmText)}</button>
          </div>
        </form>`;
      dialog.querySelector('#modal-title').textContent = title || 'Are you sure?';
      dialog.querySelector('#modal-desc').textContent = message || '';
      dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close('cancel'); });
      dialog.addEventListener('close', () => {
        resolve(dialog.returnValue === 'confirm');
        dialog.remove();
      });
      document.body.appendChild(dialog);
      dialog.showModal();
      // Destructive actions start on "Cancel" so a stray Enter doesn't delete anything.
      dialog.querySelector(danger ? 'button[value="cancel"]' : 'button[value="confirm"]').focus();
    });
  }

  // ------------------------------------------------------------ buttons + fields

  function setLoading(button, loading, text) {
    if (!button) return;
    if (loading) {
      if (button.dataset.originalHtml === undefined) button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>${escapeHtml(text || 'Please wait…')}</span>`;
    } else {
      if (button.dataset.originalHtml !== undefined) button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  function errorElementFor(input) {
    const field = input.closest('.field, .q-card, .bq-field');
    return document.getElementById(`${input.id}-error`) || (field && field.querySelector('.field-error'));
  }

  function setFieldError(input, message) {
    if (!input) return;
    const field = input.closest('.field, .q-card, .bq-field');
    const errorEl = errorElementFor(input);
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      if (field) field.classList.add('has-error');
      if (errorEl) errorEl.innerHTML = `${icon('alert')}<span>${escapeHtml(message)}</span>`;
    } else {
      input.removeAttribute('aria-invalid');
      if (field) field.classList.remove('has-error');
      if (errorEl) errorEl.innerHTML = '';
    }
  }

  function showAlert(el, message, type = 'error') {
    if (!el) return;
    if (!message) { el.hidden = true; el.innerHTML = ''; return; }
    const iconName = { error: 'alert', success: 'check-circle', warning: 'warning', info: 'info' }[type] || 'info';
    el.className = `alert alert--${type}`;
    el.innerHTML = `${icon(iconName)}<div></div>`;
    el.lastElementChild.textContent = message;
    el.hidden = false;
  }

  /** Character counter for an input/textarea with a maxlength. */
  function bindCounter(input, counterEl, max) {
    const update = () => {
      const len = input.value.length;
      counterEl.textContent = `${len.toLocaleString()} / ${max.toLocaleString()}`;
      counterEl.classList.toggle('is-near', len >= max * 0.9 && len <= max);
      counterEl.classList.toggle('is-over', len > max);
    };
    input.addEventListener('input', update);
    update();
    return update;
  }

  function fatal(message) {
    document.body.innerHTML = `
      <main class="container container--narrow page">
        <div class="card result-panel">
          <div class="result-panel__icon result-panel__icon--warning">${icon('warning')}</div>
          <h1>Something went wrong</h1>
          <p></p>
          <div class="actions"><button type="button" class="btn">Try again</button></div>
        </div>
      </main>`;
    document.querySelector('.result-panel p').textContent = message;
    document.querySelector('.result-panel .btn').addEventListener('click', () => location.reload());
  }

  return {
    icon, hydrateIcons, escapeHtml, plural, initials, formatDate, timeAgo, estimateMinutes, debounce,
    currentTheme, themeButtonHtml, bindThemeToggles, renderHeader,
    toast, confirm, setLoading, setFieldError, showAlert, bindCounter, fatal
  };
})();
