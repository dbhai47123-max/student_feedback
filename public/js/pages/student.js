// Student dashboard: open forms, progress, search and filters.
(async () => {
  const $ = id => document.getElementById(id);
  UI.hydrateIcons();

  const user = await Session.require('student');
  if (!user) return;
  UI.renderHeader(user);

  const firstName = user.name.split(' ')[0];
  $('greeting').textContent = `Hi, ${firstName}`;

  const listEl = $('list');
  const state = { forms: [], filter: 'todo', query: '' };

  try {
    const { forms } = await api('/forms');
    // Newest first, and anything still to do before anything completed.
    state.forms = forms.sort((a, b) => (a.submitted - b.submitted) || String(b.createdAt).localeCompare(String(a.createdAt)));
  } catch (err) {
    listEl.setAttribute('aria-busy', 'false');
    listEl.innerHTML = emptyState('warning', "Couldn't load your forms", err.message, '<button type="button" class="btn" id="retry">Try again</button>');
    $('retry').addEventListener('click', () => location.reload());
    return;
  }

  // If nothing is left to do, start on "All" rather than an empty list.
  if (!state.forms.some(f => !f.submitted)) state.filter = 'all';
  renderStats();
  render();

  $('search').addEventListener('input', UI.debounce(e => {
    state.query = e.target.value.trim().toLowerCase();
    render();
  }, 120));

  $('filters').addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.filter = btn.dataset.filter;
    render();
  });

  function renderStats() {
    const total = state.forms.length;
    const done = state.forms.filter(f => f.submitted).length;
    const todo = total - done;
    const pct = total ? Math.round((done / total) * 100) : 0;

    $('stats').hidden = total === 0;
    $('toolbar').hidden = total === 0;
    $('stats').innerHTML = `
      <div class="stat">
        <div class="stat__icon stat__icon--warning">${UI.icon('clock')}</div>
        <div><div class="stat__label">Waiting for you</div><div class="stat__value">${todo}</div>
        <div class="stat__sub">${todo ? `About ${UI.estimateMinutes(state.forms.filter(f => !f.submitted).flatMap(f => f.questions))} min in total` : 'All caught up'}</div></div>
      </div>
      <div class="stat">
        <div class="stat__icon stat__icon--success">${UI.icon('check-circle')}</div>
        <div><div class="stat__label">Completed</div><div class="stat__value">${done}</div><div class="stat__sub">Thanks for sharing!</div></div>
      </div>
      <div class="stat" style="flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:baseline;">
          <div class="stat__label">Your progress</div>
          <div class="stat__value" style="font-size:1.25rem">${pct}%</div>
        </div>
        <div class="meter" style="width:100%" role="progressbar" aria-label="Forms completed" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
        <div class="stat__sub">${done} of ${UI.plural(total, 'open form')} completed</div>
      </div>`;

    document.querySelector('[data-count="todo"]').textContent = todo;
    document.querySelector('[data-count="done"]').textContent = done;
    document.querySelector('[data-count="all"]').textContent = total;
  }

  function render() {
    listEl.setAttribute('aria-busy', 'false');
    document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter)));

    if (state.forms.length === 0) {
      listEl.innerHTML = emptyState('inbox', 'No feedback forms are open right now',
        "When your instructor publishes a new form, it'll show up here. Check back soon!");
      return;
    }

    const visible = state.forms.filter(f => {
      if (state.filter === 'todo' && f.submitted) return false;
      if (state.filter === 'done' && !f.submitted) return false;
      if (!state.query) return true;
      return `${f.title} ${f.description || ''}`.toLowerCase().includes(state.query);
    });

    if (visible.length === 0) {
      const message = state.query
        ? emptyState('search', 'No forms match your search', `Nothing matches "${state.query}". Try a different word.`, '<button type="button" class="btn btn--secondary" id="clear-search">Clear search</button>')
        : state.filter === 'todo'
          ? emptyState('check-circle', "You're all caught up!", "You've answered every open form. Nice work.")
          : emptyState('inbox', 'Nothing completed yet', 'Forms you submit will appear here.');
      listEl.innerHTML = message;
      const clear = $('clear-search');
      if (clear) clear.addEventListener('click', () => { $('search').value = ''; state.query = ''; render(); $('search').focus(); });
      return;
    }

    listEl.innerHTML = `<div class="card-grid">${visible.map(card).join('')}</div>`;
  }

  function card(f) {
    const minutes = UI.estimateMinutes(f.questions);
    const href = `/form.html?id=${encodeURIComponent(f.id)}`;
    return `
      <article class="form-card ${f.submitted ? 'is-done' : ''}">
        <div class="form-card__top">
          ${f.submitted
            ? '<span class="badge badge--success">Submitted</span>'
            : '<span class="badge badge--warning">Waiting for you</span>'}
          <span class="subtle" style="font-size:0.8rem">${UI.escapeHtml(UI.formatDate(f.createdAt))}</span>
        </div>
        <h2 class="form-card__title">${UI.escapeHtml(f.title)}</h2>
        ${f.description ? `<p class="form-card__desc">${UI.escapeHtml(f.description)}</p>` : ''}
        <div class="form-card__meta">
          <span>${UI.icon('clipboard')} ${UI.plural(f.questions.length, 'question')}</span>
          <span>${UI.icon('clock')} ~${minutes} min</span>
        </div>
        <div class="form-card__foot">
          ${f.submitted
            ? `<span class="btn btn--secondary btn--block" aria-disabled="true">${UI.icon('check')} Feedback sent</span>`
            : `<a class="btn btn--block" href="${href}">Start feedback ${UI.icon('arrow-right')}</a>`}
        </div>
      </article>`;
  }

  function emptyState(iconName, title, text, action = '') {
    return `
      <div class="empty-state">
        <div class="empty-state__icon">${UI.icon(iconName)}</div>
        <h3>${UI.escapeHtml(title)}</h3>
        <p>${UI.escapeHtml(text)}</p>
        ${action}
      </div>`;
  }
})();
