// HTTP hardening that applies to every request.

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
}

// Defence against cross-site request forgery for the cookie-based session.
// The session cookie is already SameSite=Strict; on top of that, any request
// that changes data must be JSON (which a plain HTML form on another site
// can't send) and, when the browser says where it came from, come from here.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function sameOriginOnly(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (origin) {
    let originHost = null;
    try { originHost = new URL(origin).host; } catch (err) { /* malformed */ }
    if (originHost !== req.get('host')) {
      return res.status(403).json({ error: 'Cross-site requests are not allowed.' });
    }
  }

  // HTML forms can only send GET and POST, so a DELETE with no body is safe.
  const hasBody = req.headers['transfer-encoding'] !== undefined ||
    (req.headers['content-length'] !== undefined && req.headers['content-length'] !== '0');
  if (req.method === 'DELETE' && !hasBody) return next();

  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) {
    return res.status(415).json({ error: 'Requests must be sent as JSON.' });
  }
  next();
}

module.exports = { securityHeaders, sameOriginOnly };
