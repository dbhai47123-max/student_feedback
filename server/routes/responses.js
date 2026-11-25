const express = require('express');
const { nanoid } = require('nanoid');
const { withData, load } = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Student submits a response to a form.
router.post('/:formId/responses', requireAuth, requireRole('student'), async (req, res) => {
  const { formId } = req.params;
  const { answers } = req.body || {};

  const data = load();
  const form = data.forms.find(f => f.id === formId);
  if (!form) return res.status(404).json({ error: 'Form not found.' });
  if (!form.isActive) return res.status(403).json({ error: 'This form is no longer accepting responses.' });

  const alreadySubmitted = data.responses.some(
    r => r.formId === formId && r.studentId === req.user.id
  );
  if (alreadySubmitted) {
    return res.status(409).json({ error: 'You already submitted feedback for this form.' });
  }

  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Answers are required.' });
  }

  for (const q of form.questions) {
    const value = answers[q.id];
    if (value === undefined || value === null || value === '') {
      return res.status(400).json({ error: `Please answer: "${q.label}"` });
    }
    if (q.type === 'rating') {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return res.status(400).json({ error: `"${q.label}" must be a rating from 1 to 5.` });
      }
    }
    if (q.type === 'choice' && !q.options.includes(value)) {
      return res.status(400).json({ error: `"${q.label}" has an invalid option selected.` });
    }
  }

  const response = {
    id: nanoid(),
    formId,
    studentId: req.user.id,
    // Responses are anonymous to the admin by default: we store the
    // student id only to enforce "one response per student per form"
    // and never expose it in the results endpoint below.
    answers,
    submittedAt: new Date().toISOString()
  };

  await withData(d => { d.responses.push(response); });
  res.status(201).json({ ok: true });
});

// Admin views aggregated + raw (anonymous) results for a form.
router.get('/:formId/responses', requireAuth, requireRole('admin'), (req, res) => {
  const { formId } = req.params;
  const data = load();

  const form = data.forms.find(f => f.id === formId);
  if (!form) return res.status(404).json({ error: 'Form not found.' });
  if (form.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'You can only view results for forms you created.' });
  }

  const responses = data.responses.filter(r => r.formId === formId);

  const summary = form.questions.map(q => {
    const values = responses.map(r => r.answers[q.id]).filter(v => v !== undefined);

    if (q.type === 'rating') {
      const nums = values.map(Number);
      const average = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
      const distribution = [1, 2, 3, 4, 5].map(n => nums.filter(v => v === n).length);
      return { id: q.id, label: q.label, type: q.type, average, distribution, count: nums.length };
    }

    if (q.type === 'choice') {
      const counts = {};
      q.options.forEach(opt => { counts[opt] = 0; });
      values.forEach(v => { if (counts[v] !== undefined) counts[v] += 1; });
      return { id: q.id, label: q.label, type: q.type, counts, count: values.length };
    }

    // text
    return { id: q.id, label: q.label, type: q.type, answers: values };
  });

  res.json({
    form: { id: form.id, title: form.title, description: form.description, questions: form.questions },
    totalResponses: responses.length,
    summary
  });
});

module.exports = router;
