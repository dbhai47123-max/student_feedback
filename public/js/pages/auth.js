// Log in / create account page.
(() => {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const next = Session.safeNext(params.get('next'));
  const alertEl = $('alert');

  UI.hydrateIcons();
  $('theme-slot').innerHTML = UI.themeButtonHtml();
  UI.bindThemeToggles($('theme-slot'));

  // Already logged in? Go straight to the right place.
  api('/auth/session', { redirectOn401: false })
    .then(({ user }) => {
      if (!user) return;
      Session.remember(user);
      window.location.replace(next || Session.homeFor(user));
    })
    .catch(() => { /* server unreachable: the form will say so on submit */ });

  if (params.get('expired')) UI.showAlert(alertEl, 'Your session has expired. Please log in again.', 'info');
  else if (next) UI.showAlert(alertEl, 'Please log in to continue.', 'info');
  else if (params.get('loggedout')) UI.showAlert(alertEl, "You've been logged out. See you next time!", 'success');

  // ------------------------------------------------------------ tabs

  const TABS = {
    login: {
      tab: $('tab-login'), panel: $('login-form'),
      title: 'Welcome back', subtitle: 'Log in to see the feedback forms waiting for you.', doc: 'Log in'
    },
    register: {
      tab: $('tab-register'), panel: $('register-form'),
      title: 'Create your account', subtitle: 'It takes less than a minute. Your feedback stays anonymous.', doc: 'Create account'
    }
  };

  function setTab(name, { focus = false } = {}) {
    Object.entries(TABS).forEach(([key, t]) => {
      const active = key === name;
      t.tab.setAttribute('aria-selected', String(active));
      t.tab.tabIndex = active ? 0 : -1;
      t.panel.hidden = !active;
    });
    $('auth-title').textContent = TABS[name].title;
    $('auth-subtitle').textContent = TABS[name].subtitle;
    document.title = `${TABS[name].doc} · KDU Feedback`;
    UI.showAlert(alertEl, null);

    const url = new URL(window.location.href);
    url.searchParams.delete('expired');
    url.searchParams.delete('loggedout');
    if (name === 'register') url.searchParams.set('tab', 'register');
    else url.searchParams.delete('tab');
    history.replaceState(null, '', url.pathname + url.search);

    if (focus) {
      const first = TABS[name].panel.querySelector('input');
      if (first) first.focus();
    }
  }

  Object.entries(TABS).forEach(([key, t]) => {
    t.tab.addEventListener('click', () => setTab(key, { focus: true }));
  });
  document.querySelector('[role="tablist"]').addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const target = TABS.login.tab.getAttribute('aria-selected') === 'true' ? 'register' : 'login';
    setTab(target);
    TABS[target].tab.focus();
  });
  document.querySelectorAll('[data-switch]').forEach(btn => {
    btn.addEventListener('click', () => setTab(btn.dataset.switch, { focus: true }));
  });

  if (params.get('tab') === 'register') setTab('register');

  // ------------------------------------------------------------ password helpers

  document.querySelectorAll('[data-toggle-password]').forEach(btn => {
    const input = $(btn.dataset.togglePassword);
    const render = () => {
      const shown = input.type === 'text';
      btn.innerHTML = UI.icon(shown ? 'eye-off' : 'eye');
      btn.setAttribute('aria-label', shown ? 'Hide password' : 'Show password');
      btn.setAttribute('aria-pressed', String(shown));
    };
    btn.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
      render();
      input.focus();
    });
    render();
  });

  function watchCapsLock(input, noteEl) {
    const check = e => {
      const on = e.getModifierState && e.getModifierState('CapsLock');
      noteEl.hidden = !on;
      noteEl.innerHTML = on ? `${UI.icon('warning')}<span>Caps Lock is on</span>` : '';
    };
    input.addEventListener('keydown', check);
    input.addEventListener('keyup', check);
    input.addEventListener('blur', () => { noteEl.hidden = true; });
  }
  watchCapsLock($('login-password'), $('login-password-caps'));
  watchCapsLock($('reg-password'), $('reg-password-caps'));

  // ------------------------------------------------------------ validation wiring
  //
  // Errors appear when you leave a field you've typed in (or on submit), then
  // update live as you fix them, so nobody is shouted at mid-word.

  function wireForm({ fields, validate }) {
    const touched = new Set();

    function applyErrors(errors, onlyTouched) {
      Object.entries(fields).forEach(([key, input]) => {
        if (onlyTouched && !touched.has(key)) return;
        UI.setFieldError(input, errors[key] || null);
      });
    }

    Object.entries(fields).forEach(([key, input]) => {
      input.addEventListener('blur', () => {
        if (input.value.trim() !== '' || touched.has(key)) {
          touched.add(key);
          applyErrors(validate().errors, true);
        }
      });
      input.addEventListener('input', () => {
        if (touched.size) applyErrors(validate().errors, true);
      });
    });

    return {
      validateAll() {
        Object.keys(fields).forEach(k => touched.add(k));
        const result = validate();
        applyErrors(result.errors, false);
        if (!result.ok) {
          const firstKey = Object.keys(fields).find(k => result.errors[k]);
          if (firstKey) fields[firstKey].focus();
        }
        return result;
      },
      applyServerErrors(errors) {
        Object.keys(errors || {}).forEach(k => touched.add(k));
        applyErrors(errors || {}, false);
        const firstKey = Object.keys(fields).find(k => errors && errors[k]);
        if (firstKey) fields[firstKey].focus();
      }
    };
  }

  // ------------------------------------------------------------ log in

  const login = {
    form: $('login-form'),
    email: $('login-email'),
    password: $('login-password'),
    remember: $('login-remember')
  };

  const loginValidation = wireForm({
    fields: { email: login.email, password: login.password },
    validate: () => Validation.validateLogin({ email: login.email.value, password: login.password.value })
  });

  login.form.addEventListener('submit', async e => {
    e.preventDefault();
    UI.showAlert(alertEl, null);
    const { ok, values } = loginValidation.validateAll();
    if (!ok) return;

    const button = login.form.querySelector('button[type="submit"]');
    UI.setLoading(button, true, 'Logging in…');
    try {
      const { user } = await api('/auth/login', {
        method: 'POST',
        redirectOn401: false,
        body: { email: values.email, password: values.password, remember: login.remember.checked }
      });
      Session.remember(user);
      window.location.replace(next || Session.homeFor(user));
    } catch (err) {
      UI.setLoading(button, false);
      if (err.fields) return loginValidation.applyServerErrors(err.fields);
      UI.showAlert(alertEl, err.message, err.status === 429 ? 'warning' : 'error');
      if (err.status === 401) {
        login.password.value = '';
        login.password.focus();
      }
    }
  });

  // ------------------------------------------------------------ create account

  const reg = {
    form: $('register-form'),
    name: $('reg-name'),
    email: $('reg-email'),
    password: $('reg-password'),
    confirm: $('reg-confirm')
  };

  const registerInput = () => ({
    name: reg.name.value,
    email: reg.email.value,
    password: reg.password.value,
    confirmPassword: reg.confirm.value
  });

  const registerValidation = wireForm({
    fields: { name: reg.name, email: reg.email, password: reg.password, confirmPassword: reg.confirm },
    validate: () => Validation.validateRegistration(registerInput())
  });

  // Live password checklist + strength meter
  const rulesEl = $('reg-password-rules');
  const strengthEl = $('reg-strength');
  const strengthLabel = $('reg-strength-label');

  function renderPasswordFeedback() {
    const pw = reg.password.value;
    const context = { name: reg.name.value, email: reg.email.value };
    rulesEl.innerHTML = Validation.passwordRules(pw, context).map(rule => `
      <li class="${rule.ok ? 'is-ok' : ''}">
        ${UI.icon('check-circle', { className: 'rule-ok' })}${UI.icon('circle', { className: 'rule-pending' })}
        <span>${UI.escapeHtml(rule.label)}</span><span class="sr-only">${rule.ok ? '(done)' : '(not yet)'}</span>
      </li>`).join('');

    const score = Validation.passwordStrength(pw, context);
    strengthEl.dataset.score = String(score);
    strengthEl.classList.toggle('has-value', pw.length > 0);
    strengthLabel.textContent = pw ? Validation.STRENGTH_LABELS[score] : 'Not set';

    const okEl = $('reg-confirm-ok');
    const matches = reg.confirm.value !== '' && reg.confirm.value === pw;
    okEl.hidden = !matches;
    okEl.innerHTML = matches ? `${UI.icon('check-circle')}<span>Passwords match</span>` : '';
  }
  [reg.password, reg.confirm, reg.name, reg.email].forEach(el => el.addEventListener('input', renderPasswordFeedback));
  renderPasswordFeedback();

  // "Did you mean …@gmail.com?" for common email typos
  const COMMON_DOMAINS = ['gmail.com', 'naver.com', 'daum.net', 'hanmail.net', 'kakao.com', 'yahoo.com',
    'hotmail.com', 'outlook.com', 'icloud.com', 'nate.com'];

  function editDistance(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return dp[a.length][b.length];
  }

  function suggestEmail() {
    const note = $('reg-email-suggest');
    const email = Validation.normalizeEmail(reg.email.value);
    const at = email.lastIndexOf('@');
    note.hidden = true;
    note.innerHTML = '';
    if (at < 1) return;
    const domain = email.slice(at + 1);
    if (!domain || COMMON_DOMAINS.includes(domain)) return;
    const match = COMMON_DOMAINS.find(d => editDistance(domain, d) <= 2);
    if (!match) return;
    const suggestion = email.slice(0, at + 1) + match;
    note.hidden = false;
    note.innerHTML = `${UI.icon('info')}<span>Did you mean <button type="button" class="link-btn">${UI.escapeHtml(suggestion)}</button>?</span>`;
    note.querySelector('button').addEventListener('click', () => {
      reg.email.value = suggestion;
      note.hidden = true;
      reg.email.dispatchEvent(new Event('input'));
      reg.email.focus();
    });
  }
  reg.email.addEventListener('blur', suggestEmail);
  reg.email.addEventListener('input', () => { if (!$('reg-email-suggest').hidden) suggestEmail(); });

  reg.form.addEventListener('submit', async e => {
    e.preventDefault();
    UI.showAlert(alertEl, null);
    const { ok, values } = registerValidation.validateAll();
    if (!ok) return;

    const button = reg.form.querySelector('button[type="submit"]');
    UI.setLoading(button, true, 'Creating your account…');
    try {
      const { user } = await api('/auth/register', {
        method: 'POST',
        redirectOn401: false,
        body: { ...values, confirmPassword: reg.confirm.value }
      });
      Session.remember(user);
      window.location.replace(next || Session.homeFor(user));
    } catch (err) {
      UI.setLoading(button, false);
      if (err.fields) return registerValidation.applyServerErrors(err.fields);
      UI.showAlert(alertEl, err.message, err.status === 429 ? 'warning' : 'error');
    }
  });
})();
