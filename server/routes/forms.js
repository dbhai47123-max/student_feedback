const express = require('express');
const { nanoid } = require('nanoid');
const { withData, load } = require('../db/db');
const Validation = require('../../shared/validation');
const asyncHandler = require('../asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function validationFailed(res, errors) {
  return res.status(400).json({ error: Validation.firstError(errors), fields: errors });
}

function buildQuestions(questions) {
  return questions.map(q => ({
    id: q.id || nanoid(),
    type: q.type,
    label: q.label,
    options: q.type === 'choice' ? q.options : undefined
  }));
}

function studentView(form, data, studentId) {
  return {
    id: form.id,
    title: form.title,
    description: form.description,
    questions: form.questions,
    isActive: form.isActive,
    createdAt: form.createdAt,
    submitted: data.responses.some(r => r.formId === form.id && r.studentId === studentId)
  };
}

// List forms.
// - Admins see every form they created, with response counts.
// - Students see only open forms, flagged with whether they've already answered.
router.get('/', requireAuth, (req, res) => {
  const data = load();

  if (req.user.role === 'admin') {
    const forms = data.forms
      .filter(f => f.createdBy === req.user.id)
      .map(f => {
        const responses = data.responses.filter(r => r.formId === f.id);
        const lastResponseAt = responses.reduce(
          (latest, r) => (!latest || r.submittedAt > latest ? r.submittedAt : latest),
          null
        );
        return { ...f, responseCount: responses.length, lastResponseAt };
      });
    const studentCount = data.users.filter(u => u.role === 'student').length;
    return res.json({ forms, studentCount });
  }

  const forms = data.forms
    .filter(f => f.isActive)
    .map(f => studentView(f, data, req.user.id));
  res.json({ forms });
});

router.get('/:id', requireAuth, (req, res) => {
  const data = load();
  const form = data.forms.find(f => f.id === req.params.id);
  if (!form) return res.status(404).json({ error: 'This form could not be found. It may have been deleted.' });

  if (req.user.role === 'student') {
    if (!form.isActive) {
      return res.status(403).json({ error: 'This form is closed and no longer accepting responses.' });
    }
    return res.json({ form: studentView(form, data, req.user.id) });
  }

  if (form.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'You can only view forms you created.' });
  }
  res.json({ form });
});

router.post('/', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const { ok, values, errors } = Validation.validateFormDefinition(req.body);
  if (!ok) return validationFailed(res, errors);

  const form = {
    id: nanoid(),
    title: values.title,
    description: values.description,
    questions: buildQuestions(values.questions.map(({ id, ...q }) => q)), // always fresh ids
    isActive: true,
    createdBy: req.user.id,
    createdAt: new Date().toISOString()
  };

  await withData(d => { d.forms.push(form); });
  res.status(201).json({ form });
}));

router.put('/:id', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const data = load();
  const form = data.forms.find(f => f.id === req.params.id);
  if (!form) return res.status(404).json({ error: 'This form could not be found. It may have been deleted.' });
  if (form.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit forms you created.' });
  }

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    return validationFailed(res, { isActive: 'isActive must be true or false.' });
  }

  const changesContent = ['title', 'description', 'questions'].some(k => body[k] !== undefined);
  let values = null;
  if (changesContent) {
    if (body.questions !== undefined && data.responses.some(r => r.formId === form.id)) {
      return res.status(409).json({
        error: "Questions can't be changed after students have responded. Create a new form instead."
      });
    }
    const merged = {
      title: body.title !== undefined ? body.title : form.title,
      description: body.description !== undefined ? body.description : form.description,
      questions: body.questions !== undefined ? body.questions : form.questions
    };
    const check = Validation.validateFormDefinition(merged);
    if (!check.ok) return validationFailed(res, check.errors);
    values = check.values;
  }

  const updated = await withData(d => {
    const f = d.forms.find(x => x.id === req.params.id);
    if (!f) return null;
    if (body.isActive !== undefined) f.isActive = body.isActive;
    if (values) {
      f.title = values.title;
      f.description = values.description;
      if (body.questions !== undefined) f.questions = buildQuestions(values.questions);
    }
    f.updatedAt = new Date().toISOString();
    return f;
  });
  if (!updated) return res.status(404).json({ error: 'This form could not be found. It may have been deleted.' });

  res.json({ form: updated });
}));

router.delete('/:id', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const form = load().forms.find(f => f.id === req.params.id);
  if (!form) return res.status(404).json({ error: 'This form could not be found. It may have been deleted.' });
  if (form.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete forms you created.' });
  }

  await withData(d => {
    d.forms = d.forms.filter(f => f.id !== req.params.id);
    d.responses = d.responses.filter(r => r.formId !== req.params.id);
  });

  res.json({ ok: true });
}));

module.exports = router;
