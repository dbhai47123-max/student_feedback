// Small in-memory rate limiter (no extra dependency needed).
// Counts are lost when the server restarts, which is fine for this app.
// Limits are deliberately generous per IP address because a whole computer
// lab usually shares one public IP.

function createLimiter({ windowMs, max }) {
  const hits = new Map(); // key -> { count, resetAt }

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  sweep.unref();

  function current(key) {
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= Date.now()) return null;
    return entry;
  }

  return {
    /** { limited, remaining, retryAfterSeconds } without recording a hit. */
    status(key) {
      const entry = current(key);
      const count = entry ? entry.count : 0;
      return {
        limited: count >= max,
        remaining: Math.max(0, max - count),
        retryAfterSeconds: entry ? Math.ceil((entry.resetAt - Date.now()) / 1000) : 0
      };
    },
    hit(key) {
      const entry = current(key);
      if (entry) entry.count += 1;
      else hits.set(key, { count: 1, resetAt: Date.now() + windowMs });
      return this.status(key);
    },
    reset(key) {
      hits.delete(key);
    }
  };
}

function minutesText(seconds) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function tooManyRequests(res, retryAfterSeconds, message) {
  res.set('Retry-After', String(Math.max(1, retryAfterSeconds)));
  return res.status(429).json({ error: `${message} Try again in ${minutesText(retryAfterSeconds)}.` });
}

/** Express middleware: at most `max` requests per IP per window. */
function limitByIp({ windowMs, max, message }) {
  const limiter = createLimiter({ windowMs, max });
  return (req, res, next) => {
    const state = limiter.status(req.ip);
    if (state.limited) return tooManyRequests(res, state.retryAfterSeconds, message);
    limiter.hit(req.ip);
    next();
  };
}

module.exports = { createLimiter, tooManyRequests, limitByIp };
