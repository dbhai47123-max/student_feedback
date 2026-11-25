const express = require('express');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const { withData, load } = require('../db/db');
const Validation = require('../../shared/validation');
const asyncHandler = require('../asyncHandler');
const { requireAuth, sessionUser, startSession, endSession, publicUser } = require('../middleware/auth');
const { createLimiter, tooManyRequests, limitByIp } = require('../middleware/rateLimit');

const router = express.Router();

const BCRYPT_ROUNDS = 12;
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;

// Compared against when the email doesn't exist, so a wrong email takes as
// long as a wrong password and response timing can't reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

// 5 wrong passwords for one account from one address -> 15 minute lockout.
const failedLogins = createLimiter({ windowMs: FIFTEEN_MINUTES, max: MAX_FAILED_LOGINS });
// Overall cap per address, so one machine can't try many different accounts.
const loginAttemptsPerIp = limitByIp({
  windowMs: FIFTEEN_MINUTES,
  max: 100,
  message: 'Too many login attempts from this network.'
});
const registrationsPerIp = limitByIp({
  windowMs: ONE_HOUR,
  max: 50,
  message: 'Too many sign-up attempts from this network.'
});

function validationFailed(res, errors) {
  return res.status(400).json({ error: Validation.firstError(errors), fields: errors });
}

// Students register themselves. Admin accounts are seeded on server start
// (see server/index.js), so a visitor can never sign up as an admin.
router.post('/register', registrationsPerIp, asyncHandler(async (req, res) => {
  const { ok, values, errors } = Validation.validateRegistration(req.body);
  if (!ok) return validationFailed(res, errors);

  if (load().users.some(u => u.email.toLowerCase() === values.email)) {
    return emailTaken(res);
  }

  const passwordHash = await bcrypt.hash(values.password, BCRYPT_ROUNDS);

  // Check again inside the write lock so two sign-ups with the same email
  // at the same moment can't both succeed.
  const user = await withData(d => {
    if (d.users.some(u => u.email.toLowerCase() === values.email)) return null;
    const created = {
      id: nanoid(),
      name: values.name,
      email: values.email,
      passwordHash,
      role: 'student',
      createdAt: new Date().toISOString()
    };
    d.users.push(created);
    return created;
  });
  if (!user) return emailTaken(res);

  startSession(res, user);
  res.status(201).json({ user: publicUser(user) });
}));

function emailTaken(res) {
  const message = 'An account with this email already exists. Try logging in instead.';
  return res.status(409).json({ error: message, fields: { email: message } });
}

router.post('/login', loginAttemptsPerIp, asyncHandler(async (req, res) => {
  const { ok, values, errors } = Validation.validateLogin(req.body);
  if (!ok) return validationFailed(res, errors);

  const lockKey = `${req.ip}|${values.email}`;
  const lock = failedLogins.status(lockKey);
  if (lock.limited) {
    return tooManyRequests(res, lock.retryAfterSeconds, 'Too many incorrect attempts for this account.');
  }

  const user = load().users.find(u => u.email.toLowerCase() === values.email);
  const passwordMatches = await bcrypt.compare(values.password, user ? user.passwordHash : DUMMY_HASH);

  if (!user || !passwordMatches) {
    const state = failedLogins.hit(lockKey);
    if (state.limited) {
      return tooManyRequests(res, state.retryAfterSeconds, 'Too many incorrect attempts for this account.');
    }
    const warning = state.remaining <= 2
      ? ` ${state.remaining} attempt${state.remaining === 1 ? '' : 's'} left before a 15-minute lockout.`
      : '';
    return res.status(401).json({ error: `Incorrect email or password.${warning}` });
  }

  failedLogins.reset(lockKey);
  startSession(res, user, { remember: values.remember });
  res.json({ user: publicUser(user) });
}));

router.post('/logout', (req, res) => {
  endSession(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Like /me, but answers 200 { user: null } when nobody is logged in.
// The login page uses it to skip ahead if you're already signed in.
router.get('/session', (req, res) => {
  res.json({ user: sessionUser(req, res).user || null });
});

module.exports = router;
