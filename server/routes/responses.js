const express = require('express');
const { nanoid } = require('nanoid');
const { withData, load } = require('../db/db');
const Validation = require('../../shared/validation');
const asyncHandler = require('../asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Student submits a response to a form.
router.post('/:formId/responses', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  const { formId } = req.params;
  const data = load();
  const form = data.forms.find(f => f.id === formId);
  if (!form) return res.status(404).json({ error: 'This form could not be found. It may have been deleted.' });
  if (!form.isActive) return res.status(403).json({ error: 'This form is closed and no longer accepting responses.' });

  const { ok, values, errors } = Validation.validateAnswers(form.questions, (req.body || {}).answers);
  if (!ok) {
    const firstId = Object.keys(errors)[0];
    const question = form.questions.find(q => q.id === firstId);
    return res.status(400).json({
      error: question ? `"${question.label}": ${errors[firstId]}` : Validation.firstError(errors),
      fields: errors
    });
  }

  // The duplicate check runs inside the write lock so a double-click can't
  // record two submissions.
  const saved = await withData(d => {
    const already = d.responses.some(r => r.formId === formId && r.studentId === req.user.id);
    if (already) return false;
    d.responses.push({
      id: nanoid(),
      formId,
      // Responses are anonymous to admins: the student id is stored only to
      // enforce one response per student per form, and is never sent back
      // by the results endpoint below.
      studentId: req.user.id,
      answers: values, // only answers to this form's questions, already cleaned
      submittedAt: new Date().toISOString()
    });
    return true;
  });

  if (!saved) {
    return res.status(409).json({ error: 'You already submitted feedback for this form.' });
  }
  res.status(201).json({ ok: true });
}));

// Admin views aggregated + anonymous results for a form.
router.get('/:formId/responses', requireAuth, requireRole('admin'), (req, res) => {
  const { formId } = req.params;
  const data = load();

  const form = data.forms.find(f => f.id === formId);
  if (!form) return res.status(404).json({ error: 'This form could not be found. It may have been deleted.' });
  if (form.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'You can only view results for forms you created.' });
  }

  const responses = data.responses.filter(r => r.formId === formId);

  const summary = form.questions.map(q => {
    const values = responses.map(r => r.answers[q.id]).filter(v => v !== undefined);

    if (q.type === 'rating') {
      const nums = values.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 5);
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
    const answers = values.filter(v => typeof v === 'string' && v.trim() !== '');
    return { id: q.id, label: q.label, type: q.type, answers, count: answers.length };
  });

  res.json({
    form: {
      id: form.id,
      title: form.title,
      description: form.description,
      isActive: form.isActive,
      createdAt: form.createdAt,
      questions: form.questions
    },
    totalResponses: responses.length,
    studentCount: data.users.filter(u => u.role === 'student').length,
    summary
  });
});

module.exports = router;
