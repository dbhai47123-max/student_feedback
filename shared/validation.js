/*
 * Shared validation rules for the Student Feedback System.
 *
 * This one file is used in two places so the rules can never drift apart:
 *   - the server:  const Validation = require('../shared/validation');
 *   - the browser: <script src="/shared/validation.js"></script>  -> window.Validation
 *
 * Every validator returns { ok, values, errors }:
 *   values - the cleaned-up input (trimmed, normalised) that should be stored
 *   errors - { fieldName: 'Human readable message' } for each invalid field
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Validation = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LIMITS = Object.freeze({
    nameMin: 2,
    nameMax: 60,
    emailMax: 254,
    emailLocalMax: 64,
    passwordMin: 8,
    passwordMaxBytes: 72, // bcrypt silently ignores anything past 72 bytes
    loginPasswordMax: 1024,
    formTitleMin: 3,
    formTitleMax: 120,
    formDescriptionMax: 500,
    questionsMax: 30,
    questionLabelMin: 3,
    questionLabelMax: 200,
    optionsMin: 2,
    optionsMax: 10,
    optionMax: 80,
    textAnswerMax: 1000
  });

  const QUESTION_TYPES = Object.freeze(['rating', 'choice', 'text']);
  const RATING_LABELS = Object.freeze(['Very poor', 'Poor', 'Okay', 'Good', 'Excellent']);

  // Letters from any language (so Korean, Arabic, accented names all work),
  // plus spaces, apostrophes, hyphens and periods between them.
  const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} '.\-]*$/u;
  const EMAIL_LOCAL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/;
  const DOMAIN_LABEL_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
  const TLD_RE = /^[A-Za-z]{2,63}$/;
  const SYMBOL_RE = /[^\p{L}\p{N}\s]/u;
  const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

  const COMMON_PASSWORDS = new Set([
    'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd',
    '12345678', '123456789', '1234567890', '11111111', '00000000', '87654321',
    'qwerty12', 'qwerty123', 'qwertyuiop', 'asdfghjkl', 'abc12345', 'abcd1234',
    'iloveyou', 'iloveyou1', 'letmein1', 'welcome1', 'welcome123', 'admin123',
    'administrator', 'football1', 'monkey123', 'sunshine1', 'princess1', 'dragon123',
    'student1', 'student123', 'changeme', 'changeme1', 'kyungdong', 'kyungdong1'
  ]);

  // ---------------------------------------------------------------- helpers

  function asString(value) {
    return typeof value === 'string' ? value : '';
  }

  function collapseSpaces(value) {
    return asString(value).trim().replace(/\s+/g, ' ');
  }

  function byteLength(value) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
    return unescape(encodeURIComponent(value)).length;
  }

  function result(values, errors) {
    return { ok: Object.keys(errors).length === 0, values, errors };
  }

  function firstError(errors) {
    const keys = Object.keys(errors || {});
    return keys.length ? errors[keys[0]] : null;
  }

  // ---------------------------------------------------------------- fields

  function normalizeEmail(value) {
    return asString(value).trim().toLowerCase();
  }

  function isValidEmail(email) {
    if (!email || email.length > LIMITS.emailMax) return false;
    const at = email.lastIndexOf('@');
    if (at < 1 || at !== email.indexOf('@')) return false;
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (local.length > LIMITS.emailLocalMax || !EMAIL_LOCAL_RE.test(local)) return false;
    if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
    const labels = domain.split('.');
    if (labels.length < 2) return false;
    if (!labels.every(l => DOMAIN_LABEL_RE.test(l))) return false;
    return TLD_RE.test(labels[labels.length - 1]);
  }

  function validateName(value) {
    const name = collapseSpaces(value);
    if (!name) return { value: name, error: 'Enter your full name.' };
    if (name.length < LIMITS.nameMin) return { value: name, error: `Name must be at least ${LIMITS.nameMin} characters.` };
    if (name.length > LIMITS.nameMax) return { value: name, error: `Name must be ${LIMITS.nameMax} characters or fewer.` };
    if (!NAME_RE.test(name)) return { value: name, error: 'Use letters, spaces, hyphens, apostrophes or periods only.' };
    return { value: name, error: null };
  }

  function validateEmail(value) {
    const email = normalizeEmail(value);
    if (!email) return { value: email, error: 'Enter your email address.' };
    if (email.length > LIMITS.emailMax) return { value: email, error: 'That email address is too long.' };
    if (!isValidEmail(email)) return { value: email, error: 'Enter a valid email address, like name@example.com.' };
    return { value: email, error: null };
  }

  function isCommonPassword(password) {
    const lower = asString(password).toLowerCase();
    const stripped = lower.replace(/[^a-z0-9]+$/g, ''); // "Password1!" -> "password1"
    return COMMON_PASSWORDS.has(lower) || COMMON_PASSWORDS.has(stripped);
  }

  function containsPersonalInfo(password, context) {
    const lower = asString(password).toLowerCase();
    const parts = [];
    const email = normalizeEmail(context && context.email);
    if (email.includes('@')) parts.push(email.split('@')[0]);
    collapseSpaces(context && context.name).toLowerCase().split(' ').forEach(p => parts.push(p));
    return parts.some(p => p.length >= 3 && lower.includes(p));
  }

  /** The checklist shown under the sign-up password field, in display order. */
  function passwordRules(password, context) {
    const pw = asString(password);
    return [
      { id: 'length', label: `At least ${LIMITS.passwordMin} characters`, ok: pw.length >= LIMITS.passwordMin },
      { id: 'lower', label: 'One lowercase letter', ok: /[a-z]/.test(pw) },
      { id: 'upper', label: 'One uppercase letter', ok: /[A-Z]/.test(pw) },
      { id: 'number', label: 'One number', ok: /[0-9]/.test(pw) },
      { id: 'symbol', label: 'One symbol, like ! @ # ?', ok: SYMBOL_RE.test(pw) },
      { id: 'personal', label: "Doesn't contain your name or email", ok: pw.length > 0 && !containsPersonalInfo(pw, context) }
    ];
  }

  /** 0 (too weak) .. 4 (strong). Used only for the strength meter. */
  function passwordStrength(password, context) {
    const pw = asString(password);
    if (!pw) return 0;
    if (isCommonPassword(pw) || containsPersonalInfo(pw, context)) return 0;
    const variety = [/[a-z]/, /[A-Z]/, /[0-9]/, SYMBOL_RE].filter(r => r.test(pw)).length;
    let score = 0;
    if (pw.length >= LIMITS.passwordMin) score += 1;
    if (pw.length >= 12) score += 1;
    if (variety >= 3) score += 1;
    if (variety === 4 && pw.length >= 10) score += 1;
    if (/(.)\1{2,}/.test(pw) || /(?:0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf)/i.test(pw)) score -= 1;
    if (pw.length < LIMITS.passwordMin) score = Math.min(score, 1);
    return Math.max(0, Math.min(4, score));
  }

  const STRENGTH_LABELS = Object.freeze(['Too weak', 'Weak', 'Fair', 'Good', 'Strong']);

  function validateNewPassword(value, context) {
    const password = asString(value);
    if (!password) return { value: password, error: 'Create a password.' };
    if (password !== password.trim()) return { value: password, error: "Password can't start or end with a space." };
    if (byteLength(password) > LIMITS.passwordMaxBytes) {
      return { value: password, error: `Password is too long (maximum ${LIMITS.passwordMaxBytes} characters).` };
    }
    const failed = passwordRules(password, context).find(r => !r.ok);
    if (failed) {
      const messages = {
        length: `Password must be at least ${LIMITS.passwordMin} characters.`,
        lower: 'Password needs at least one lowercase letter.',
        upper: 'Password needs at least one uppercase letter.',
        number: 'Password needs at least one number.',
        symbol: 'Password needs at least one symbol, like ! @ # or ?.',
        personal: "Password can't contain your name or email."
      };
      return { value: password, error: messages[failed.id] };
    }
    if (isCommonPassword(password)) {
      return { value: password, error: 'This password is too common. Choose something harder to guess.' };
    }
    return { value: password, error: null };
  }

  // ---------------------------------------------------------------- auth

  function validateRegistration(input) {
    const data = input || {};
    const errors = {};
    const name = validateName(data.name);
    const email = validateEmail(data.email);
    const password = validateNewPassword(data.password, { name: name.value, email: email.value });
    const confirmPassword = asString(data.confirmPassword);

    if (name.error) errors.name = name.error;
    if (email.error) errors.email = email.error;
    if (password.error) errors.password = password.error;
    if (!confirmPassword) errors.confirmPassword = 'Re-enter your password.';
    else if (confirmPassword !== password.value) errors.confirmPassword = "Passwords don't match.";

    return result({ name: name.value, email: email.value, password: password.value }, errors);
  }

  function validateLogin(input) {
    const data = input || {};
    const errors = {};
    const email = validateEmail(data.email);
    const password = asString(data.password);

    if (email.error) errors.email = email.error;
    if (!password) errors.password = 'Enter your password.';
    else if (password.length > LIMITS.loginPasswordMax) errors.password = 'That password is too long.';

    return result({ email: email.value, password, remember: data.remember === true }, errors);
  }

  // ---------------------------------------------------------------- forms

  function validateQuestion(raw, index, errors) {
    const q = raw && typeof raw === 'object' ? raw : {};
    const prefix = `q.${index}`;
    const type = QUESTION_TYPES.includes(q.type) ? q.type : null;
    const label = collapseSpaces(q.label);
    const clean = { type: type || 'rating', label };
    if (typeof q.id === 'string' && ID_RE.test(q.id)) clean.id = q.id;

    if (!type) errors[`${prefix}.type`] = 'Choose an answer type.';
    if (!label) errors[`${prefix}.label`] = 'Enter the question text.';
    else if (label.length < LIMITS.questionLabelMin) errors[`${prefix}.label`] = `Question must be at least ${LIMITS.questionLabelMin} characters.`;
    else if (label.length > LIMITS.questionLabelMax) errors[`${prefix}.label`] = `Question must be ${LIMITS.questionLabelMax} characters or fewer.`;

    if (type === 'choice') {
      const options = (Array.isArray(q.options) ? q.options : []).map(collapseSpaces).filter(Boolean);
      clean.options = options;
      const seen = new Set();
      const duplicate = options.find(o => {
        const key = o.toLowerCase();
        if (seen.has(key)) return true;
        seen.add(key);
        return false;
      });
      if (options.length < LIMITS.optionsMin) errors[`${prefix}.options`] = `Add at least ${LIMITS.optionsMin} options.`;
      else if (options.length > LIMITS.optionsMax) errors[`${prefix}.options`] = `Use ${LIMITS.optionsMax} options or fewer.`;
      else if (options.some(o => o.length > LIMITS.optionMax)) errors[`${prefix}.options`] = `Each option must be ${LIMITS.optionMax} characters or fewer.`;
      else if (duplicate) errors[`${prefix}.options`] = `"${duplicate}" is listed more than once. Options must be unique.`;
    }
    return clean;
  }

  function validateFormDefinition(input) {
    const data = input || {};
    const errors = {};
    const title = collapseSpaces(data.title);
    const description = asString(data.description).trim();

    if (!title) errors.title = 'Give your form a title.';
    else if (title.length < LIMITS.formTitleMin) errors.title = `Title must be at least ${LIMITS.formTitleMin} characters.`;
    else if (title.length > LIMITS.formTitleMax) errors.title = `Title must be ${LIMITS.formTitleMax} characters or fewer.`;

    if (description.length > LIMITS.formDescriptionMax) {
      errors.description = `Description must be ${LIMITS.formDescriptionMax} characters or fewer.`;
    }

    const rawQuestions = Array.isArray(data.questions) ? data.questions : [];
    if (rawQuestions.length === 0) errors.questions = 'Add at least one question.';
    else if (rawQuestions.length > LIMITS.questionsMax) errors.questions = `A form can have at most ${LIMITS.questionsMax} questions.`;

    const questions = rawQuestions.slice(0, LIMITS.questionsMax).map((q, i) => validateQuestion(q, i, errors));
    return result({ title, description, questions }, errors);
  }

  // ---------------------------------------------------------------- answers

  /**
   * Checks a student's answers against the form's questions.
   * errors are keyed by question id; values only contain known question ids.
   */
  function validateAnswers(questions, answers) {
    const given = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};
    const errors = {};
    const values = {};

    (questions || []).forEach(q => {
      const raw = given[q.id];
      if (q.type === 'rating') {
        const n = typeof raw === 'number' ? raw : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN);
        if (raw === undefined || raw === null || raw === '') errors[q.id] = 'Choose a rating from 1 to 5.';
        else if (!Number.isInteger(n) || n < 1 || n > 5) errors[q.id] = 'Rating must be a whole number from 1 to 5.';
        else values[q.id] = n;
      } else if (q.type === 'choice') {
        if (typeof raw !== 'string' || raw === '') errors[q.id] = 'Choose one of the options.';
        else if (!(q.options || []).includes(raw)) errors[q.id] = 'Choose one of the listed options.';
        else values[q.id] = raw;
      } else {
        const text = asString(raw).trim();
        if (!text) errors[q.id] = 'Write a short answer.';
        else if (text.length > LIMITS.textAnswerMax) errors[q.id] = `Keep your answer to ${LIMITS.textAnswerMax} characters or fewer.`;
        else values[q.id] = text;
      }
    });

    return result(values, errors);
  }

  return Object.freeze({
    LIMITS,
    QUESTION_TYPES,
    RATING_LABELS,
    STRENGTH_LABELS,
    normalizeEmail,
    isValidEmail,
    isCommonPassword,
    passwordRules,
    passwordStrength,
    validateName,
    validateEmail,
    validateNewPassword,
    validateRegistration,
    validateLogin,
    validateFormDefinition,
    validateAnswers,
    firstError
  });
});
