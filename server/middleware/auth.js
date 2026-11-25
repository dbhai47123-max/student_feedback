const jwt = require('jsonwebtoken');
const { load } = require('../db/db');

const DEFAULT_SECRET = 'dev-secret-change-me';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
const USING_DEFAULT_SECRET = JWT_SECRET === DEFAULT_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const SESSION_COOKIE = 'fb_session';
const SHORT_SESSION = { jwt: '12h' };                                   // closes with the browser
const LONG_SESSION = { jwt: '7d', cookieMaxAge: 7 * 24 * 60 * 60 * 1000 }; // "Keep me signed in"

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

// The session token lives in an httpOnly cookie, so page scripts (and any
// injected script) can never read it. SameSite=Strict keeps other sites
// from sending it along with their requests.
function startSession(res, user, { remember = false } = {}) {
  const session = remember ? LONG_SESSION : SHORT_SESSION;
  const token = jwt.sign({ role: user.role }, JWT_SECRET, {
    algorithm: 'HS256',
    subject: user.id,
    expiresIn: session.jwt
  });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: IS_PRODUCTION,
    path: '/',
    maxAge: session.cookieMaxAge
  });
}

function endSession(res) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'strict', secure: IS_PRODUCTION, path: '/' });
}

/**
 * Reads the session cookie and returns { user } or { error }.
 * A bad or stale cookie is cleared so the browser stops sending it.
 */
function sessionUser(req, res) {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  if (!token) return { error: 'Please log in to continue.' };

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    endSession(res);
    return { error: 'Your session has expired. Please log in again.' };
  }

  // Always use the stored account, not what the token claims, so a deleted
  // account or a changed role takes effect immediately.
  const user = load().users.find(u => u.id === payload.sub);
  if (!user || user.role !== payload.role) {
    endSession(res);
    return { error: 'Your session is no longer valid. Please log in again.' };
  }
  return { user: publicUser(user) };
}

function requireAuth(req, res, next) {
  const { user, error } = sessionUser(req, res);
  if (!user) return res.status(401).json({ error });
  req.user = user;
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `Only ${role}s can do that.` });
    }
    next();
  };
}

module.exports = {
  sessionUser,
  requireAuth,
  requireRole,
  startSession,
  endSession,
  publicUser,
  USING_DEFAULT_SECRET,
  IS_PRODUCTION
};
