// Admin dashboard: list of forms + the form builder.
(async () => {
  const $ = id => document.getElementById(id);
  const L = Validation.LIMITS;
  UI.hydrateIcons();

  const user = await Session.require('admin');
  if (!user) return;
  UI.renderHeader(user);

  // =================================================================== dashboard

  const listEl = $('list');
  let forms = [];
  let studentCount = 0;
  const view = { filter: 'all', query: '', sort: 'newest' };

  async function loadForms() {
    try {
      const data = await api('/forms');
      forms = data.forms;
      studentCount = data.studentCount || 0;
      renderDashboard();
    } catch (err) {
      listEl.setAttribute('aria-busy', 'false');
      listEl.innerHTML = emptyState('warning', "Couldn't load your forms", err.message,
        '<button type="button" class="btn" data-act="retry">Try again</button>');
    }
  }

  function renderDashboard() {
    renderStats();
    renderList();
  }

  function renderStats() {
    const open = forms.filter(f => f.isActive).length;
    const responses = forms.reduce((sum, f) => sum + f.responseCount, 0);
    const tile = (iconName, tone, label, value, sub) => `
      <div class="stat">
        <div class="stat__icon ${tone}">${UI.icon(iconName)}</div>
        <div><div class="stat__label">${label}</div><div class="stat__value">${value.toLocaleString()}</div><div class="stat__sub">${sub}</div></div>
      </div>`;
    $('stats').innerHTML =
      tile('clipboard', '', 'Total forms', forms.length, `${open} open · ${forms.length - open} closed`) +
      tile('unlock', 'stat__icon--success', 'Accepting responses', open, open ? 'Visible to students now' : 'No forms are open') +
      tile('message', 'stat__icon--warning', 'Responses received', responses, forms.length ? `${(responses / forms.length).toFixed(1)} per form on average` : 'Create a form to start') +
      tile('users', 'stat__icon--neutral', 'Registered students', studentCount, 'Can respond to open forms');
  }

  function renderList() {
    listEl.setAttribute('aria-busy', 'false');
    $('toolbar').hidden = forms.length === 0;
    document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === view.filter)));

    if (forms.length === 0) {
      listEl.innerHTML = emptyState('clipboard', 'Create your first feedback form',
        'Start from a template or build your own with rating, multiple choice and short answer questions.',
        `<button type="button" class="btn" data-act="new">${UI.icon('plus')} New form</button>`);
      return;
    }

    const q = view.query;
    const visible = forms
      .filter(f => view.filter === 'all' || (view.filter === 'open' ? f.isActive : !f.isActive))
      .filter(f => !q || `${f.title} ${f.description || ''}`.toLowerCase().includes(q))
      .sort(sorters[view.sort]);

    if (visible.length === 0) {
      listEl.innerHTML = emptyState('search', 'No forms match', 'Try a different search or filter.',
        '<button type="button" class="btn btn--secondary" data-act="clear-filters">Clear filters</button>');
      return;
    }
    listEl.innerHTML = `<div class="form-list">${visible.map(row).join('')}</div>`;
  }

  const sorters = {
    newest: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
    oldest: (a, b) => String(a.createdAt).localeCompare(String(b.createdAt)),
    responses: (a, b) => b.responseCount - a.responseCount,
    title: (a, b) => a.title.localeCompare(b.title)
  };

  function row(f) {
    const rate = studentCount ? Math.min(100, Math.round((f.responseCount / studentCount) * 100)) : 0;
    const id = UI.escapeHtml(f.id);
    return `
      <article class="form-row">
        <div class="form-row__main">
          <div class="form-row__title">
            <h3>${UI.escapeHtml(f.title)}</h3>
            ${f.isActive ? '<span class="badge badge--success">Open</span>' : '<span class="badge badge--neutral">Closed</span>'}
          </div>
          ${f.description ? `<p class="form-row__desc">${UI.escapeHtml(f.description)}</p>` : ''}
          <div class="form-row__meta">
            <span>${UI.icon('calendar')} Created ${UI.escapeHtml(UI.formatDate(f.createdAt))}</span>
            <span>${UI.icon('clipboard')} ${UI.plural(f.questions.length, 'question')}</span>
            <span>${UI.icon('activity')} ${f.lastResponseAt ? `Last response ${UI.timeAgo(f.lastResponseAt)}` : 'No responses yet'}</span>
          </div>
        </div>
        <div class="form-row__stats">
          <div class="figure"><strong>${f.responseCount.toLocaleString()}</strong>${f.responseCount === 1 ? 'response' : 'responses'}</div>
          <div class="meter" role="img" aria-label="Response rate ${rate}%"><span style="width:${rate}%"></span></div>
          <div class="subtle" style="font-size:0.78rem">${rate}% of ${UI.plural(studentCount, 'student')}</div>
        </div>
        <div class="form-row__actions">
          <a class="btn btn--secondary btn--sm" href="/results.html?id=${encodeURIComponent(f.id)}">${UI.icon('chart')} Results</a>
          <button type="button" class="btn btn--ghost btn--sm" data-act="toggle" data-id="${id}">
            ${f.isActive ? `${UI.icon('lock')} Close` : `${UI.icon('unlock')} Reopen`}
          </button>
          <button type="button" class="btn btn--danger-ghost btn--sm btn--icon" data-act="delete" data-id="${id}"
                  aria-label="Delete ${UI.escapeHtml(f.title)}" title="Delete form">${UI.icon('trash')}</button>
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

  listEl.addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'retry') return loadForms();
    if (act === 'new') return openBuilder();
    if (act === 'clear-filters') {
      view.filter = 'all'; view.query = ''; $('search').value = '';
      return renderList();
    }
    const form = forms.find(f => f.id === btn.dataset.id);
    if (!form) return;
    if (act === 'toggle') return toggleForm(form, btn);
    if (act === 'delete') return deleteForm(form, btn);
  });

  async function toggleForm(form, btn) {
    const opening = !form.isActive;
    if (!opening) {
      const ok = await UI.confirm({
        title: `Close "${form.title}"?`,
        message: 'Students will no longer see this form or be able to respond. You can reopen it at any time.',
        confirmText: 'Close form',
        iconName: 'lock'
      });
      if (!ok) return;
    }
    UI.setLoading(btn, true, opening ? 'Opening…' : 'Closing…');
    try {
      const { form: updated } = await api(`/forms/${encodeURIComponent(form.id)}`, { method: 'PUT', body: { isActive: opening } });
      form.isActive = updated.isActive;
      renderDashboard();
      UI.toast(opening ? `"${form.title}" is open again. Students can respond.` : `"${form.title}" is closed.`);
    } catch (err) {
      UI.setLoading(btn, false);
      UI.toast(err.message, { type: 'error' });
    }
  }

  async function deleteForm(form, btn) {
    const ok = await UI.confirm({
      title: `Delete "${form.title}"?`,
      message: form.responseCount
        ? `This permanently deletes the form and its ${UI.plural(form.responseCount, 'response')}. This can't be undone.`
        : "This permanently deletes the form. This can't be undone.",
      confirmText: 'Delete form',
      danger: true
    });
    if (!ok) return;
    UI.setLoading(btn, true, '');
    try {
      await api(`/forms/${encodeURIComponent(form.id)}`, { method: 'DELETE' });
      forms = forms.filter(f => f.id !== form.id);
      renderDashboard();
      UI.toast(`"${form.title}" was deleted.`);
    } catch (err) {
      UI.setLoading(btn, false);
      UI.toast(err.message, { type: 'error' });
    }
  }

  $('search').addEventListener('input', UI.debounce(e => {
    view.query = e.target.value.trim().toLowerCase();
    renderList();
  }, 120));
  $('filters').addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    view.filter = btn.dataset.filter;
    renderList();
  });
  $('sort').addEventListener('change', e => { view.sort = e.target.value; renderList(); });
  $('new-form-btn').addEventListener('click', () => openBuilder());

  // =================================================================== builder

  const TEMPLATES = {
    course: {
      name: 'Course feedback',
      title: 'Course feedback',
      description: 'Help us improve this course. Your answers are anonymous and only seen as combined results.',
      questions: [
        { type: 'rating', label: 'How clear were the lectures?' },
        { type: 'rating', label: 'How useful were the course materials?' },
        { type: 'rating', label: 'How fair was the workload?' },
        { type: 'choice', label: 'How was the pace of the course?', options: ['Too slow', 'Just right', 'Too fast'] },
        { type: 'text', label: 'What is one thing that would improve this course?' }
      ]
    },
    facility: {
      name: 'Facility feedback',
      title: 'Campus facilities feedback',
      description: 'Tell us how the classrooms, labs and study spaces are working for you.',
      questions: [
        { type: 'rating', label: 'How clean and comfortable are the classrooms?' },
        { type: 'rating', label: 'How reliable are the lab computers and Wi-Fi?' },
        { type: 'choice', label: 'Which facility do you use most?', options: ['Library', 'Computer labs', 'Study rooms', 'Cafeteria'] },
        { type: 'text', label: 'What should we fix or add first?' }
      ]
    },
    event: {
      name: 'Event feedback',
      title: 'Event feedback',
      description: 'Thanks for coming! Let us know how the event went.',
      questions: [
        { type: 'rating', label: 'Overall, how would you rate the event?' },
        { type: 'rating', label: 'How relevant was the content to your studies?' },
        { type: 'choice', label: 'Would you attend a similar event again?', options: ['Yes', 'Maybe', 'No'] },
        { type: 'text', label: 'What did you enjoy most, and what could be better?' }
      ]
    }
  };

  const TYPE_META = {
    rating: { label: 'Rating', icon: 'star' },
    choice: { label: 'Multiple choice', icon: 'list' },
    text: { label: 'Short answer', icon: 'text' }
  };

  let draft = null;
  let keySeq = 0;
  let builderDirty = false;
  let showErrors = false;

  const newQuestion = (type = 'rating', label = '', options) => ({
    key: `k${++keySeq}`,
    type,
    label,
    options: options ? [...options] : (type === 'choice' ? ['', ''] : [])
  });

  $('templates').insertAdjacentHTML('beforeend', Object.entries(TEMPLATES).map(([key, t]) =>
    `<button type="button" class="template-btn" data-template="${key}">${UI.escapeHtml(t.name)}</button>`).join(''));

  const titleCounter = UI.bindCounter($('b-title'), $('b-title-count'), L.formTitleMax);
  const descCounter = UI.bindCounter($('b-desc'), $('b-desc-count'), L.formDescriptionMax);

  function openBuilder({ pushHistory = true } = {}) {
    draft = { questions: [newQuestion('rating')] };
    $('b-title').value = '';
    $('b-desc').value = '';
    titleCounter(); descCounter();
    builderDirty = false;
    showErrors = false;
    clearBuilderErrors();
    renderQuestions();
    $('dashboard-view').hidden = true;
    $('builder-view').hidden = false;
    document.body.classList.add('has-bottom-bar');
    document.title = 'New form · KDU Feedback admin';
    if (pushHistory && location.hash !== '#new') history.pushState({ builder: true }, '', '#new');
    window.scrollTo({ top: 0 });
    $('b-title').focus();
  }

  function showDashboard() {
    $('builder-view').hidden = true;
    $('dashboard-view').hidden = false;
    document.body.classList.remove('has-bottom-bar');
    document.title = 'Feedback forms · KDU Feedback admin';
    window.scrollTo({ top: 0 });
  }

  async function confirmDiscard() {
    if (!builderDirty) return true;
    return UI.confirm({
      title: 'Discard this form?',
      message: "You have unsaved changes. If you leave now, they'll be lost.",
      confirmText: 'Discard',
      cancelText: 'Keep editing',
      danger: true
    });
  }

  /**
   * Leave the builder. If we pushed the "#new" history entry ourselves, step
   * back over it so the browser's Back button stays natural; otherwise (page
   * opened directly at #new) just drop the hash.
   */
  function leaveBuilder() {
    builderDirty = false;
    if (history.state && history.state.builder) {
      history.back(); // popstate shows the dashboard
    } else {
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      showDashboard();
    }
  }

  async function requestCloseBuilder() {
    if (!(await confirmDiscard())) return;
    leaveBuilder();
  }

  window.addEventListener('popstate', async () => {
    if (location.hash === '#new') {
      if ($('builder-view').hidden) openBuilder({ pushHistory: false });
      return;
    }
    if ($('builder-view').hidden) return;
    if (builderDirty && !(await confirmDiscard())) {
      history.pushState({ builder: true }, '', '#new');
      return;
    }
    builderDirty = false;
    showDashboard();
  });

  window.addEventListener('beforeunload', e => {
    if (builderDirty && !$('builder-view').hidden) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  $('builder-back').addEventListener('click', requestCloseBuilder);
  $('builder-cancel').addEventListener('click', requestCloseBuilder);

  $('templates').addEventListener('click', async e => {
    const btn = e.target.closest('[data-template]');
    if (!btn) return;
    const t = TEMPLATES[btn.dataset.template];
    const hasContent = $('b-title').value.trim() || draft.questions.some(q => q.label.trim());
    if (hasContent) {
      const ok = await UI.confirm({
        title: `Use the "${t.name}" template?`,
        message: 'This replaces the title, description and questions you have so far.',
        confirmText: 'Use template',
        iconName: 'sparkles'
      });
      if (!ok) return;
    }
    $('b-title').value = t.title;
    $('b-desc').value = t.description;
    titleCounter(); descCounter();
    draft.questions = t.questions.map(q => newQuestion(q.type, q.label, q.options));
    builderDirty = true;
    renderQuestions();
    refreshErrors();
    UI.toast(`"${t.name}" template added. Edit anything you like before publishing.`, { type: 'info' });
  });

  // ------------------------------------------------------------ question cards

  function renderQuestions() {
    const container = $('questions');
    container.innerHTML = draft.questions.map((q, i) => questionCard(q, i, draft.questions.length)).join('');
    const n = draft.questions.length;
    $('questions-count').textContent = `${n} of ${L.questionsMax}`;
    $('builder-summary').textContent = n ? `${UI.plural(n, 'question')} · about ${UI.estimateMinutes(draft.questions)} min for students` : 'No questions yet';
    document.querySelectorAll('[data-add]').forEach(b => { b.disabled = n >= L.questionsMax; });
    if (showErrors) refreshErrors();
  }

  function questionCard(q, i, total) {
    const k = q.key;
    const typeSwitch = Object.entries(TYPE_META).map(([type, meta]) => `
      <label>
        <input type="radio" name="type-${k}" value="${type}" ${q.type === type ? 'checked' : ''} data-field="type">
        <span>${UI.icon(meta.icon)} ${meta.label}</span>
      </label>`).join('');

    let body = '';
    if (q.type === 'choice') {
      body = `
        <div class="options-editor bq-field">
          <span class="label">Options</span>
          ${q.options.map((opt, oi) => `
            <div class="option-row">
              <span class="option-row__dot" aria-hidden="true"></span>
              <label class="sr-only" for="opt-${k}-${oi}">Option ${oi + 1}</label>
              <input class="input" type="text" id="opt-${k}-${oi}" value="${UI.escapeHtml(opt)}" maxlength="${L.optionMax}"
                     placeholder="Option ${oi + 1}" data-field="option" data-index="${oi}" aria-describedby="opt-err-${k}">
              <button type="button" class="btn btn--ghost btn--icon btn--sm" data-act="del-opt" data-index="${oi}"
                      aria-label="Remove option ${oi + 1}" title="Remove option" ${q.options.length <= L.optionsMin ? 'disabled' : ''}>${UI.icon('x')}</button>
            </div>`).join('')}
          <button type="button" class="btn btn--ghost btn--sm" data-act="add-opt" ${q.options.length >= L.optionsMax ? 'disabled' : ''}>
            ${UI.icon('plus')} Add option
          </button>
          <p class="field-error" id="opt-err-${k}"></p>
        </div>`;
    } else if (q.type === 'rating') {
      body = `<div class="bq__preview"><span class="mini-scale" aria-hidden="true"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></span>
        Students pick from 1 (Very poor) to 5 (Excellent).</div>`;
    } else {
      body = `<div class="bq__preview">${UI.icon('text')} Students write a short answer (up to ${L.textAnswerMax.toLocaleString()} characters).</div>`;
    }

    return `
      <section class="bq" data-key="${k}" aria-label="Question ${i + 1}">
        <div class="bq__head">
          <span class="bq__num">Q${i + 1}</span>
          <div class="type-switch" role="radiogroup" aria-label="Answer type for question ${i + 1}">${typeSwitch}</div>
          <div class="bq__actions">
            <button type="button" class="btn btn--ghost btn--icon btn--sm" data-act="up" aria-label="Move question ${i + 1} up" title="Move up" ${i === 0 ? 'disabled' : ''}>${UI.icon('arrow-up')}</button>
            <button type="button" class="btn btn--ghost btn--icon btn--sm" data-act="down" aria-label="Move question ${i + 1} down" title="Move down" ${i === total - 1 ? 'disabled' : ''}>${UI.icon('arrow-down')}</button>
            <button type="button" class="btn btn--ghost btn--icon btn--sm" data-act="dup" aria-label="Duplicate question ${i + 1}" title="Duplicate" ${total >= L.questionsMax ? 'disabled' : ''}>${UI.icon('copy')}</button>
            <button type="button" class="btn btn--danger-ghost btn--icon btn--sm" data-act="del" aria-label="Delete question ${i + 1}" title="Delete question">${UI.icon('trash')}</button>
          </div>
        </div>
        <div class="field bq-field">
          <div class="label-row">
            <label class="label" for="label-${k}">Question</label>
            <span class="char-count" id="label-count-${k}">${q.label.length} / ${L.questionLabelMax}</span>
          </div>
          <input class="input" type="text" id="label-${k}" value="${UI.escapeHtml(q.label)}" maxlength="${L.questionLabelMax}"
                 placeholder="${q.type === 'text' ? 'e.g. What could we do better?' : q.type === 'choice' ? 'e.g. How was the pace of the course?' : 'e.g. How clear were the lectures?'}"
                 data-field="label" aria-describedby="label-err-${k}">
          <p class="field-error" id="label-err-${k}"></p>
        </div>
        ${body}
      </section>`;
  }

  const questionFor = el => {
    const card = el.closest('.bq');
    return card ? draft.questions.find(q => q.key === card.dataset.key) : null;
  };

  $('questions').addEventListener('input', e => {
    const q = questionFor(e.target);
    if (!q) return;
    const field = e.target.dataset.field;
    if (field === 'label') {
      q.label = e.target.value;
      const counter = $(`label-count-${q.key}`);
      if (counter) counter.textContent = `${q.label.length} / ${L.questionLabelMax}`;
    } else if (field === 'option') {
      q.options[Number(e.target.dataset.index)] = e.target.value;
    } else return;
    builderDirty = true;
    if (showErrors) refreshErrors();
  });

  $('questions').addEventListener('change', e => {
    if (e.target.dataset.field !== 'type') return;
    const q = questionFor(e.target);
    q.type = e.target.value;
    if (q.type === 'choice' && q.options.length < L.optionsMin) {
      while (q.options.length < L.optionsMin) q.options.push('');
    }
    builderDirty = true;
    renderQuestions();
    const checked = document.querySelector(`.bq[data-key="${q.key}"] input[data-field="type"]:checked`);
    if (checked) checked.focus();
  });

  $('questions').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const q = questionFor(btn);
    const qs = draft.questions;
    const i = qs.indexOf(q);
    let focusSelector = null;

    switch (btn.dataset.act) {
      case 'up':
        if (i > 0) [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]];
        focusSelector = `.bq[data-key="${q.key}"] [data-act="${i - 1 === 0 ? 'down' : 'up'}"]`;
        break;
      case 'down':
        if (i < qs.length - 1) [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]];
        focusSelector = `.bq[data-key="${q.key}"] [data-act="${i + 1 === qs.length - 1 ? 'up' : 'down'}"]`;
        break;
      case 'dup': {
        const copy = newQuestion(q.type, q.label, q.options);
        qs.splice(i + 1, 0, copy);
        focusSelector = `#label-${copy.key}`;
        break;
      }
      case 'del':
        qs.splice(i, 1);
        if (qs.length) focusSelector = `#label-${qs[Math.min(i, qs.length - 1)].key}`;
        break;
      case 'add-opt':
        if (q.options.length < L.optionsMax) q.options.push('');
        focusSelector = `#opt-${q.key}-${q.options.length - 1}`;
        break;
      case 'del-opt':
        if (q.options.length > L.optionsMin) q.options.splice(Number(btn.dataset.index), 1);
        focusSelector = `#opt-${q.key}-${Math.max(0, Number(btn.dataset.index) - 1)}`;
        break;
      default:
        return;
    }
    builderDirty = true;
    renderQuestions();
    const target = focusSelector && document.querySelector(focusSelector);
    if (target && !target.disabled) target.focus();
    else if (!qs.length) document.querySelector('[data-add="rating"]').focus();
  });

  document.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (draft.questions.length >= L.questionsMax) return;
      const q = newQuestion(btn.dataset.add);
      draft.questions.push(q);
      builderDirty = true;
      renderQuestions();
      const input = $(`label-${q.key}`);
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  ['b-title', 'b-desc'].forEach(id => $(id).addEventListener('input', () => {
    builderDirty = true;
    if (showErrors) refreshErrors();
  }));

  // ------------------------------------------------------------ validation + publish

  function payload() {
    return {
      title: $('b-title').value,
      description: $('b-desc').value,
      questions: draft.questions.map(q => ({
        type: q.type,
        label: q.label,
        options: q.type === 'choice' ? q.options : undefined
      }))
    };
  }

  function clearBuilderErrors() {
    UI.setFieldError($('b-title'), null);
    UI.setFieldError($('b-desc'), null);
    $('questions-error').innerHTML = '';
  }

  function applyErrors(errors) {
    UI.setFieldError($('b-title'), errors.title);
    UI.setFieldError($('b-desc'), errors.description);
    $('questions-error').innerHTML = errors.questions ? `${UI.icon('alert')}<span>${UI.escapeHtml(errors.questions)}</span>` : '';

    draft.questions.forEach((q, i) => {
      const card = document.querySelector(`.bq[data-key="${q.key}"]`);
      if (!card) return;
      UI.setFieldError($(`label-${q.key}`), errors[`q.${i}.label`]);
      const optErr = $(`opt-err-${q.key}`);
      if (optErr) {
        const msg = errors[`q.${i}.options`];
        optErr.innerHTML = msg ? `${UI.icon('alert')}<span>${UI.escapeHtml(msg)}</span>` : '';
        card.querySelectorAll('[data-field="option"]').forEach(inp => {
          const empty = !inp.value.trim();
          if (msg && (empty || q.options.filter(Boolean).length >= L.optionsMin)) inp.setAttribute('aria-invalid', 'true');
          else inp.removeAttribute('aria-invalid');
        });
      }
      card.classList.toggle('has-error', Boolean(errors[`q.${i}.label`] || errors[`q.${i}.options`]));
    });
  }

  function refreshErrors() {
    const { errors } = Validation.validateFormDefinition(payload());
    applyErrors(errors);
    return errors;
  }

  function focusFirstError() {
    const target = document.querySelector('#builder-form [aria-invalid="true"]') ||
      (document.querySelector('#questions-error:not(:empty)') && document.querySelector('[data-add="rating"]'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
    }
  }

  $('builder-form').addEventListener('submit', async e => {
    e.preventDefault();
    showErrors = true;
    const errors = refreshErrors();
    const count = Object.keys(errors).length;
    if (count) {
      focusFirstError();
      UI.toast(count === 1 ? 'Fix the highlighted field before publishing.' : `Fix the ${count} highlighted fields before publishing.`, { type: 'error' });
      return;
    }

    const button = $('publish-btn');
    UI.setLoading(button, true, 'Publishing…');
    try {
      const { form } = await api('/forms', { method: 'POST', body: payload() });
      UI.setLoading(button, false);
      forms.unshift({ ...form, responseCount: 0, lastResponseAt: null });
      view.filter = 'all';
      renderDashboard();
      leaveBuilder();
      UI.toast(`"${form.title}" is live. Students can respond now.`);
    } catch (err) {
      UI.setLoading(button, false);
      if (err.fields) {
        applyErrors(err.fields);
        focusFirstError();
      }
      UI.toast(err.message, { type: 'error', duration: 7000 });
    }
  });

  // ------------------------------------------------------------ start

  await loadForms();
  if (location.hash === '#new') openBuilder({ pushHistory: false });
})();
