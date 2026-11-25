// Aggregated, anonymous results for one form.
//
// Chart choices follow the dataviz guide: one data series per chart, so a
// single blue hue and no legend; horizontal bars on a shared baseline
// (square at the baseline, 4px rounded data end, <= 24px thick); every bar
// carries its value as text so nothing depends on colour or hover; hover and
// keyboard focus add a tooltip on top.
(async () => {
  const $ = id => document.getElementById(id);
  UI.hydrateIcons();

  const user = await Session.require('admin');
  if (!user) return;
  UI.renderHeader(user);

  const formId = new URLSearchParams(window.location.search).get('id');
  if (!formId) return showError('No form selected', 'Go back and choose a form to see its results.');

  let data;
  try {
    data = await api(`/forms/${encodeURIComponent(formId)}/responses`);
  } catch (err) {
    return showError("Couldn't load results", err.message);
  }

  render(data);
  $('print-btn').addEventListener('click', () => window.print());
  bindTooltips();

  function showError(title, text) {
    $('loading').hidden = true;
    const view = $('error-view');
    view.hidden = false;
    view.innerHTML = `
      <div class="card result-panel">
        <div class="result-panel__icon result-panel__icon--warning">${UI.icon('warning')}</div>
        <h1></h1><p></p>
        <div class="actions"><a class="btn" href="/admin.html">${UI.icon('arrow-left')} Back to forms</a></div>
      </div>`;
    view.querySelector('h1').textContent = title;
    view.querySelector('p').textContent = text;
  }

  function render({ form, totalResponses, studentCount, summary }) {
    document.title = `Results: ${form.title} · KDU Feedback admin`;
    $('form-title').textContent = form.title;
    $('form-desc').textContent = form.description || '';
    $('form-desc').hidden = !form.description;
    $('status-line').innerHTML = `${form.isActive ? 'Open' : 'Closed'} · Created ${UI.escapeHtml(UI.formatDate(form.createdAt))}`;

    const ratingAverages = summary.filter(q => q.type === 'rating' && q.average !== null).map(q => q.average);
    const overall = ratingAverages.length ? ratingAverages.reduce((a, b) => a + b, 0) / ratingAverages.length : null;
    const rate = studentCount ? Math.min(100, Math.round((totalResponses / studentCount) * 100)) : 0;

    $('stats').innerHTML = `
      <div class="stat">
        <div class="stat__icon">${UI.icon('message')}</div>
        <div><div class="stat__label">Responses</div><div class="stat__value">${totalResponses.toLocaleString()}</div>
        <div class="stat__sub">${form.isActive ? 'Still collecting' : 'Form is closed'}</div></div>
      </div>
      <div class="stat" style="flex-direction:column; gap:10px">
        <div style="display:flex; justify-content:space-between; align-items:baseline; width:100%">
          <div class="stat__label">Response rate</div><div class="stat__value" style="font-size:1.25rem">${rate}%</div>
        </div>
        <div class="meter" style="width:100%" role="img" aria-label="Response rate ${rate}%"><span style="width:${rate}%"></span></div>
        <div class="stat__sub">${totalResponses.toLocaleString()} of ${UI.plural(studentCount, 'registered student')}</div>
      </div>
      <div class="stat">
        <div class="stat__icon stat__icon--warning">${UI.icon('star')}</div>
        <div><div class="stat__label">Average rating</div>
        <div class="stat__value">${overall !== null ? overall.toFixed(1) : '–'}${overall !== null ? '<small> / 5</small>' : ''}</div>
        <div class="stat__sub">${ratingAverages.length ? `Across ${UI.plural(ratingAverages.length, 'rating question')}` : 'No rating answers yet'}</div></div>
      </div>`;

    if (totalResponses === 0) {
      $('summary').innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">${UI.icon('inbox')}</div>
          <h3>No responses yet</h3>
          <p>${form.isActive
            ? 'Results appear here as soon as the first student responds. Make sure students know the form is open.'
            : 'This form is closed. Reopen it from the forms list to start collecting responses.'}</p>
        </div>`;
    } else {
      $('summary').innerHTML = summary.map((q, i) => questionCard(q, i)).join('');
      $('summary').querySelectorAll('[data-show-all]').forEach(btn => btn.addEventListener('click', () => {
        btn.closest('.result-card').querySelectorAll('.quote[hidden]').forEach(el => { el.hidden = false; });
        btn.remove();
      }));
    }

    $('loading').hidden = true;
    $('results-view').hidden = false;
  }

  function questionCard(q, i) {
    const typeLabel = { rating: 'Rating 1–5', choice: 'Multiple choice', text: 'Short answer' }[q.type];
    let body = '';

    if (q.type === 'rating') {
      const avg = q.average;
      const stars = [1, 2, 3, 4, 5].map(n =>
        UI.icon('star', { className: avg !== null && avg >= n - 0.25 ? 'is-full' : 'is-empty' })).join('');
      const rows = [5, 4, 3, 2, 1].map(n => ({
        label: `${n} · ${Validation.RATING_LABELS[n - 1]}`,
        count: q.distribution[n - 1]
      }));
      body = `
        <div class="rating-summary">
          <div class="rating-score">
            <div class="rating-score__value">${avg !== null ? avg.toFixed(1) : '–'}<small> / 5</small></div>
            <div class="rating-score__stars" role="img" aria-label="Average ${avg !== null ? avg.toFixed(1) : 'not available'} out of 5">${stars}</div>
            <div class="rating-score__count">${UI.plural(q.count, 'rating')}</div>
          </div>
          ${bars(rows, q.count, q.label)}
        </div>`;
    } else if (q.type === 'choice') {
      const rows = Object.entries(q.counts).map(([label, count]) => ({ label, count }));
      body = bars(rows, q.count, q.label) +
        `<p class="subtle" style="font-size:0.8rem; margin-top:12px">${UI.plural(q.count, 'answer')}</p>`;
    } else {
      const SHOW = 5;
      const answers = q.answers || [];
      body = answers.length
        ? `<div class="quotes-tools"><span class="subtle" style="font-size:0.85rem">${UI.plural(answers.length, 'written answer')}</span></div>
           <div class="quotes">${answers.map((a, idx) => `<blockquote class="quote" style="margin:0" ${idx >= SHOW ? 'hidden' : ''}>${UI.escapeHtml(a)}</blockquote>`).join('')}</div>
           ${answers.length > SHOW ? `<button type="button" class="btn btn--secondary btn--sm no-print" style="margin-top:12px" data-show-all>Show all ${answers.length} answers</button>` : ''}`
        : '<p class="subtle">No written answers yet.</p>';
    }

    return `
      <article class="card result-card">
        <div class="result-card__head">
          <span class="q-num" aria-hidden="true">${i + 1}</span>
          <div><h3>${UI.escapeHtml(q.label)}</h3><div class="result-card__type">${typeLabel}</div></div>
        </div>
        <div class="result-card__body">${body}</div>
      </article>`;
  }

  /** Horizontal bars, one per row, all sharing one baseline and one scale. */
  function bars(rows, total, questionLabel) {
    const max = Math.max(1, ...rows.map(r => r.count));
    const top = Math.max(...rows.map(r => r.count));
    return `
      <div class="bars" role="list" aria-label="${UI.escapeHtml(`Answers to: ${questionLabel}`)}">
        ${rows.map(r => {
          const pct = total ? Math.round((r.count / total) * 100) : 0;
          const width = (r.count / max) * 100;
          const isTop = r.count > 0 && r.count === top;
          const desc = `${r.label}: ${UI.plural(r.count, 'response')}, ${pct}%`;
          return `
            <div class="bar-row ${isTop ? 'is-top' : ''}" role="listitem" tabindex="0" aria-label="${UI.escapeHtml(desc)}"
                 data-tip-title="${UI.escapeHtml(`${r.count.toLocaleString()} · ${pct}%`)}" data-tip-label="${UI.escapeHtml(r.label)}">
              <span class="bar-row__label" aria-hidden="true">${UI.escapeHtml(r.label)}</span>
              <span class="bar-row__track bars--baseline" aria-hidden="true"><span class="bar-row__fill" style="width:${width}%"></span></span>
              <span class="bar-row__value" aria-hidden="true"><strong>${r.count.toLocaleString()}</strong> · ${pct}%</span>
            </div>`;
        }).join('')}
      </div>`;
  }

  function bindTooltips() {
    const tip = $('tooltip');
    const show = row => {
      const fill = row.querySelector('.bar-row__fill');
      const track = row.querySelector('.bar-row__track');
      const rect = (fill.offsetWidth > 4 ? fill : track).getBoundingClientRect();
      tip.innerHTML = '<strong></strong><span></span>';
      tip.querySelector('strong').textContent = row.dataset.tipTitle;
      tip.querySelector('span').textContent = row.dataset.tipLabel;
      tip.style.left = `${Math.min(window.innerWidth - 130, Math.max(130, rect.left + rect.width))}px`;
      tip.style.top = `${rect.top}px`;
      tip.hidden = false;
    };
    const hide = () => { tip.hidden = true; };
    const summary = $('summary');
    summary.addEventListener('pointerover', e => { const row = e.target.closest('.bar-row'); if (row) show(row); });
    summary.addEventListener('pointerout', e => { if (e.target.closest('.bar-row')) hide(); });
    summary.addEventListener('focusin', e => { const row = e.target.closest('.bar-row'); if (row) show(row); });
    summary.addEventListener('focusout', hide);
    window.addEventListener('scroll', hide, { passive: true });
  }
})();
