const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');

const { load, withData } = require('./db/db');
const authRoutes = require('./routes/auth');
const formsRoutes = require('./routes/forms');
const responsesRoutes = require('./routes/responses');

const PORT = process.env.PORT || 3000;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function seedAdmin() {
  const data = load();
  const exists = data.users.some(u => u.role === 'admin');
  if (exists) return;

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
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

async function main() {
  await seedAdmin();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  app.use('/api/forms', formsRoutes);
  // Mounted at /api/forms too: routes/responses.js defines
  // "/:formId/responses" so the final paths are
  // POST /api/forms/:formId/responses and GET /api/forms/:formId/responses
  app.use('/api/forms', responsesRoutes);

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });

  app.listen(PORT, () => {
    console.log(`Student Feedback System running at http://localhost:${PORT}`);
  });
}

main();
