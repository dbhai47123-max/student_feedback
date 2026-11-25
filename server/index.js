require('./loadEnv'); // must run before anything reads process.env

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');

const { load, withData } = require('./db/db');
const { securityHeaders, sameOriginOnly } = require('./middleware/security');
const { USING_DEFAULT_SECRET, IS_PRODUCTION } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const formsRoutes = require('./routes/forms');
const responsesRoutes = require('./routes/responses');

const PORT = process.env.PORT || 3000;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SHARED_DIR = path.join(__dirname, '..', 'shared');

async function seedAdmin() {
  const data = load();
  const exists = data.users.some(u => u.role === 'admin');
  if (exists) return;

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await withData(d => {
    d.users.push({
      id: nanoid(),
      name: 'Administrator',
      email: ADMIN_EMAIL,
      passwordHash,
      role: 'admin',
      createdAt: new Date().toISOString()
    });
  });
  console.log(`Seeded admin account -> email: ${ADMIN_EMAIL}  password: ${ADMIN_PASSWORD}`);
  console.log('Change this via ADMIN_EMAIL / ADMIN_PASSWORD env vars before deploying.');
}

function checkSecret() {
  if (!USING_DEFAULT_SECRET) return;
  if (IS_PRODUCTION) {
    console.error('Refusing to start: set JWT_SECRET to a long random string when NODE_ENV=production.');
    process.exit(1);
  }
  console.warn('Warning: using the default JWT_SECRET. Set JWT_SECRET in .env before deploying.');
}

async function main() {
  checkSecret();
  await seedAdmin();

  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', sameOriginOnly);
  app.use('/api/auth', authRoutes);
  app.use('/api/forms', formsRoutes);
  // Mounted at /api/forms too: routes/responses.js defines
  // "/:formId/responses" so the final paths are
  // POST /api/forms/:formId/responses and GET /api/forms/:formId/responses
  app.use('/api/forms', responsesRoutes);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  // Validation rules shared with the browser (see shared/validation.js).
  app.use('/shared', express.static(SHARED_DIR));
  app.use(express.static(PUBLIC_DIR));

  app.get('*', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'The request body is not valid JSON.' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'The request is too large.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
  });

  app.listen(PORT, () => {
    console.log(`Student Feedback System running at http://localhost:${PORT}`);
  });
}

main();
