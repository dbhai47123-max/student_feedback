const express = require('express');
const { nanoid } = require('nanoid');
const { withData, load } = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_QUESTION_TYPES = ['rating', 'text', 'choice'];

function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return 'At least one question is required.';
  }
  for (const q of questions) {
    if (!q.label || typeof q.label !== 'string') {
      return 'Every question needs a label.';
    }
    if (!ALLOWED_QUESTION_TYPES.includes(q.type)) {
      return `Question type must be one of: ${ALLOWED_QUESTION_TYPES.join(', ')}.`;
    }
    if (q.type === 'choice' && (!Array.isArray(q.options) || q.options.length < 2)) {
      return 'Choice questions need at least two options.';
    }
  }
  return null;
}

// List forms.
// - Admins see every form they created, with response counts.
// - Students see only active forms, flagged with whether they've
//   already submitted a response.
router.get('/', requireAuth, (req, res) => {
  const data = load();

  if (req.user.role === 'admin') {
    const forms = data.forms
      .filter(f => f.createdBy === req.user.id)
      .map(f => ({
        ...f,
        responseCount: data.responses.filter(r => r.formId === f.id).length
      }));
    return res.json({ forms });
  }

  const forms = data.forms
    .filter(f => f.isActive)
    .map(f => {
      const submitted = data.responses.some(
        r => r.formId === f.id && r.studentId === req.user.id
      );
      return {
        id: f.id,
        title: f.title,
        description: f.description,
        questions: f.questions,
        createdAt: f.createdAt,
        submitted
      };
    });
  res.json({ forms });
});

router.get('/:id', requireAuth, (req, res) => {
  const data = load();
  const form = data.forms.find(f => f.id === req.params.id);
  if (!form) return res.status(404).json({ error: 'Form not found.' });

  if (req.user.role === 'student' && !form.isActive) {
    return res.status(403).json({ error: 'This form is no longer accepting responses.' });
  }
  if (req.user.role === 'admin' && form.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'You can only view forms you created.' });
  }

  res.json({ form });
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { title, description, questions } = req.body || {};

  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'A form title is required.' });
  }
  const validationError = validateQuestions(questions);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const form = {
    id: nanoid(),
    title,
    description: description || '',
    questions: questions.map(q => ({
      id: nanoid(),
      type: q.type,
      label: q.label,
      options: q.type === 'choice' ? q.options : undefined
    })),
    isActive: true,
    createdBy: req.user.id,
    createdAt: new Date().toISOString()
  };

  await withData(d => { d.forms.push(form); });
  res.status(201).json({ form });
});

router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { title, description, isActive, questions } = req.body || {};

  const data = load();
  const form = data.forms.find(f => f.id === req.params.id);
  if (!form) return res.status(404).json({ error: 'Form not found.' });
  if (form.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit forms you created.' });
  }

  if (questions !== undefined) {
    const validationError = validateQuestions(questions);
    if (validationError) return res.status(400).json({ error: validationError });
  }

  await withData(d => {
    const f = d.forms.find(x => x.id === req.params.id);
    if (title !== undefined) f.title = title;
    if (description !== undefined) f.description = description;
    if (isActive !== undefined) f.isActive = !!isActive;
    if (questions !== undefined) {
      f.questions = questions.map(q => ({
        id: q.id || nanoid(),
        type: q.type,
        label: q.label,
        options: q.type === 'choice' ? q.options : undefined
      }));
    }
  });

  const updated = load().forms.find(f => f.id === req.params.id);
  res.json({ form: updated });
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const data = load();
  const form = data.forms.find(f => f.id === req.params.id);
  if (!form) return res.status(404).json({ error: 'Form not found.' });
  if (form.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete forms you created.' });
  }

  await withData(d => {
    d.forms = d.forms.filter(f => f.id !== req.params.id);
    d.responses = d.responses.filter(r => r.formId !== req.params.id);
  });

  res.json({ ok: true });
});

module.exports = router;
