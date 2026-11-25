// A student filling in one feedback form.
(async () => {
  const $ = id => document.getElementById(id);
  UI.hydrateIcons();

  const user = await Session.require('student');
  if (!user) return;
  UI.renderHeader(user);

  const formId = new URLSearchParams(window.location.search).get('id');
  const MAX_TEXT = Validation.LIMITS.textAnswerMax;
  let form = null;
  let dirty = false;
  let submitted = false;
  let showErrors = false;

  if (!formId) {
    return showState('warning', 'No form selected', "This link doesn't point to a feedback form. Go back and pick one from your list.");
  }

  try {
    ({ form } = await api(`/forms/${encodeURIComponent(formId)}`));
  } catch (err) {
    const closed = err.status === 403;
    return showState(closed ? 'lock' : 'warning', closed ? 'This form is closed' : "Couldn't open this form", err.message);
  }

  if (form.submitted) {
    return showState('check-circle', 'You already sent feedback for this form',
      'Thanks! Each form accepts one response per student, so there is nothing more to do here.', 'success');
  }

  renderForm();

  // ------------------------------------------------------------ rendering

  function showState(iconName, title, text, tone = 'warning') {
    $('loading').hidden = true;
    $('form-view').hidden = true;
    const view = $('state-view');
    view.hidden = false;
    const toneClass = tone === 'success' ? '' : tone === 'neutral' ? 'result-panel__icon--neutral' : 'result-panel__icon--warning';
    view.innerHTML = `
      <div class="card result-panel">
        <div class="result-panel__icon ${toneClass}">${UI.icon(iconName)}</div>
        <h1></h1>
        <p></p>
        <div class="actions"><a class="btn" href="/student.html">${UI.icon('arrow-left')} Back to my forms</a></div>
      </div>`;
    view.querySelector('h1').textContent = title;
    view.querySelector('p').textContent = text;
    document.title = `${title} · KDU Feedback`;
  }

  function renderForm() {
    document.title = `${form.title} · KDU Feedback`;
    $('form-title').textContent = form.title;
    $('form-desc').textContent = form.description || '';
    $('form-desc').hidden = !form.description;
    $('form-chips').innerHTML = `
      <span class="chip">${UI.icon('clipboard')} ${UI.plural(form.questions.length, 'question')}</span>
      <span class="chip">${UI.icon('clock')} About ${UI.estimateMinutes(form.questions)} min</span>
      <span class="chip">${UI.icon('shield')} Anonymous</span>`;

    $('questions').innerHTML = form.questions.map(questionHtml).join('');
    form.questions.filter(q => q.type === 'text').forEach(q => {
      UI.bindCounter($(`ans-${q.id}`), $(`count-${q.id}`), MAX_TEXT);
    });

    $('loading').hidden = true;
    $('form-view').hidden = false;
    updateProgress();

    $('feedback-form').addEventListener('input', onChange);
    $('feedback-form').addEventListener('change', onChange);
    $('feedback-form').addEventListener('submit', onSubmit);
  }

  function questionHtml(q, i) {
    const label = UI.escapeHtml(q.label);
    const errId = `err-${q.id}`;
    let control;

    if (q.type === 'rating') {
      control = `
        <div class="rating-scale">
          ${Validation.RATING_LABELS.map((word, idx) => `
            <label class="rating-option">
              <input type="radio" name="ans-${q.id}" value="${idx + 1}" aria-describedby="${errId}">
              <span class="rating-box"><span class="num">${idx + 1}</span><span class="word">${word}</span></span>
              <span class="sr-only">${idx + 1}: ${word}</span>
            </label>`).join('')}
        </div>
        <div class="rating-ends" aria-hidden="true"><span>1 = Very poor</span><span>5 = Excellent</span></div>`;
    } else if (q.type === 'choice') {
      control = `
        <div class="choice-list">
          ${q.options.map(opt => `
            <label class="choice">
              <input type="radio" name="ans-${q.id}" value="${UI.escapeHtml(opt)}" aria-describedby="${errId}">
              <span class="choice__dot" aria-hidden="true"></span>
              <span class="choice__text">${UI.escapeHtml(opt)}</span>
            </label>`).join('')}
        </div>`;
    } else {
      control = `
        <label class="sr-only" for="ans-${q.id}">Your answer</label>
        <textarea class="textarea" id="ans-${q.id}" name="ans-${q.id}" rows="4" maxlength="${MAX_TEXT}"
                  placeholder="Share your thoughts…" aria-describedby="${errId} count-${q.id}"></textarea>
        <div class="field-meta"><span></span><span class="char-count" id="count-${q.id}"></span></div>`;
    }

    return `
      <fieldset class="q-card" id="q-${q.id}" data-qid="${q.id}">
        <legend class="q-title"><span class="q-num" aria-hidden="true">${i + 1}</span><span>${label}<span class="req" aria-hidden="true">*</span><span class="sr-only"> (required)</span></span></legend>
        ${control}
        <p class="field-error" id="${errId}"></p>
      </fieldset>`;
  }

  // ------------------------------------------------------------ state

  function collectAnswers() {
    const answers = {};
    const els = $('feedback-form').elements;
    form.questions.forEach(q => {
      const el = els[`ans-${q.id}`];
      if (!el) return;
      const value = el.value; // RadioNodeList.value gives the checked radio's value
      if (q.type === 'rating') answers[q.id] = value ? Number(value) : '';
      else answers[q.id] = value;
    });
    return answers;
  }

  function updateProgress() {
    const { errors } = Validation.validateAnswers(form.questions, collectAnswers());
    const total = form.questions.length;
    const answered = form.questions.filter(q => !errors[q.id]).length;
    const pct = total ? Math.round((answered / total) * 100) : 0;
    $('progress-text').textContent = `${answered} of ${total} answered`;
    $('progress-pct').textContent = `${pct}%`;
    $('progress-fill').style.width = `${pct}%`;

    form.questions.forEach(q => {
      const card = $(`q-${q.id}`);
      card.classList.toggle('is-answered', !errors[q.id]);
      if (showErrors) setQuestionError(q, errors[q.id]);
    });
    return errors;
  }

  function setQuestionError(q, message) {
    const card = $(`q-${q.id}`);
    const errEl = $(`err-${q.id}`);
    card.classList.toggle('has-error', Boolean(message));
    errEl.innerHTML = message ? `${UI.icon('alert')}<span>${UI.escapeHtml(message)}</span>` : '';
    card.querySelectorAll('input, textarea').forEach(el => {
      if (message) el.setAttribute('aria-invalid', 'true');
      else el.removeAttribute('aria-invalid');
    });
  }

  function onChange() {
    dirty = true;
    updateProgress();
  }

  window.addEventListener('beforeunload', e => {
    if (dirty && !submitted) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // ------------------------------------------------------------ submit

  async function onSubmit(e) {
    e.preventDefault();
    showErrors = true;
    const errors = updateProgress();
    const missing = form.questions.filter(q => errors[q.id]);

    if (missing.length) {
      const first = $(`q-${missing[0].id}`);
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusable = first.querySelector('input, textarea');
      if (focusable) focusable.focus({ preventScroll: true });
      UI.toast(missing.length === 1
        ? 'One question still needs an answer.'
        : `${missing.length} questions still need an answer.`, { type: 'error' });
      return;
    }

    const button = $('submit-btn');
    UI.setLoading(button, true, 'Submitting…');
    try {
      const { values } = Validation.validateAnswers(form.questions, collectAnswers());
      await api(`/forms/${encodeURIComponent(formId)}/responses`, { method: 'POST', body: { answers: values } });
      submitted = true;
      showSuccess();
    } catch (err) {
      UI.setLoading(button, false);
      if (err.fields) {
        form.questions.forEach(q => setQuestionError(q, err.fields[q.id]));
      }
      if (err.status === 409) {
        submitted = true;
        return showState('check-circle', 'You already sent feedback for this form', err.message, 'success');
      }
      UI.toast(err.message, { type: 'error', duration: 7000 });
    }
  }

  async function showSuccess() {
    let remaining = null;
    try {
      const { forms } = await api('/forms');
      remaining = forms.filter(f => !f.submitted).length;
    } catch (e) { /* the count is a nice-to-have */ }

    $('form-view').hidden = true;
    const view = $('state-view');
    view.hidden = false;
    view.innerHTML = `
      <div class="card result-panel">
        <div class="result-panel__icon">${UI.icon('check')}</div>
        <h1 tabindex="-1">Thank you for your feedback!</h1>
        <p>Your response to <strong></strong> was submitted anonymously.
          ${remaining ? `You have ${UI.plural(remaining, 'more form')} waiting.` : remaining === 0 ? "That was the last one, you're all caught up." : ''}</p>
        <div class="actions">
          <a class="btn" href="/student.html">${UI.icon('arrow-left')} Back to my forms</a>
        </div>
      </div>`;
    view.querySelector('strong').textContent = form.title;
    view.querySelector('h1').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.title = 'Feedback sent · KDU Feedback';
  }
})();
