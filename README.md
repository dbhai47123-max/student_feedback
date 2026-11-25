# KDU Feedback: Student Feedback System

A full-stack feedback system for a university course: students submit
feedback on configurable forms (course feedback, facility feedback,
event feedback, anything an admin sets up), and admins review
anonymous, aggregated results.

## Stack

- **Backend:** Node.js + Express, bcrypt password hashing, JWT sessions
  stored in an httpOnly cookie
- **Storage:** a JSON file (`server/db/data.json`), auto-created on
  first run, so there's no database server to install. See "Using a real
  database" below to swap in Postgres/MySQL/SQLite later.
- **Frontend:** plain HTML/CSS/JS, no build step. Light and dark themes,
  responsive down to phone width.

## Features

- **Students:** create an account, see open feedback forms with their
  progress, search and filter them, and submit answers (rating 1–5,
  multiple choice, or short text). One submission per form.
- **Admins:** log in with a seeded admin account, build forms with a
  question builder (templates, reorder, duplicate, live validation),
  open/close forms, view results (averages, distributions, response
  rate, anonymous written answers), print or save results as PDF,
  delete forms.
- Feedback is anonymous to admins: responses are never shown with a
  student's name attached. The student id is only used server-side to
  block duplicate submissions.

## Getting started

```bash
npm install
npm start
```

Then open **http://localhost:3000**.

On first run the server prints a seeded admin login, e.g.:

```
Seeded admin account -> email: admin@example.com  password: admin123
```

Use that to log in as admin and create your first form. Students can
create their own accounts from the same page.

To change the admin credentials, port or session secret, copy
`.env.example` to `.env` and edit it (or just set the environment
variables before `npm start`).

To start over with an empty database, stop the server, delete
`server/db/data.json`, and start it again.

## Validation

All validation rules live in **one file, `shared/validation.js`**, which
is loaded by the server (`require`) *and* by the browser
(`/shared/validation.js`). The browser uses it for instant inline
feedback; the server uses the same rules as the real gatekeeper, so
the two can never disagree.

| Field | Rules |
|---|---|
| Name | 2–60 characters; letters (any language), spaces, `-` `'` `.` |
| Email | valid format (`name@domain.tld`), max 254, stored lowercase, must be unique |
| Password (sign-up) | 8+ characters, upper + lower case, a number, a symbol; not a common password; can't contain your name or email; max 72 bytes (bcrypt's limit); must match "Confirm password" |
| Form title | 3–120 characters |
| Description | up to 500 characters |
| Questions | 1–30 per form; text 3–200 characters |
| Multiple choice | 2–10 options, unique (case-insensitive), max 80 characters each |
| Answers | every question required; rating is a whole number 1–5; choice must be one of the options; written answers up to 1,000 characters |

Server errors come back as `{ error, fields: { fieldName: message } }`
so the page can show each message next to the right field.

In the browser, errors appear when you leave a field (or on submit),
then update live while you fix them. The sign-up form also shows a
password strength meter, a live requirements checklist, a show/hide
password toggle, a Caps Lock warning, and "did you mean …@gmail.com?"
suggestions for common email typos.

## Security

- **Passwords** are hashed with bcrypt (12 rounds) and never stored or
  returned in plain text.
- **Sessions** use a signed JWT (HS256) in an **httpOnly, SameSite=Strict
  cookie**, so page scripts can't read it. Sessions last 12 hours, or 7
  days with "Keep me signed in". On every request the server re-checks
  that the account still exists and has the same role.
- **Brute-force protection:** 5 wrong passwords for an account locks it
  for 15 minutes (per network address), plus generous per-IP caps on
  login and sign-up. Login errors never reveal whether an email exists.
- **CSRF protection:** besides the SameSite cookie, every request that
  changes data must be JSON and come from the same origin.
- **Headers:** Content-Security-Policy (no inline scripts), X-Frame-Options,
  nosniff, Referrer-Policy. Request bodies are capped at 100 kB.
- **Roles:** students can't create forms or see results; admins can only
  manage forms they created. Questions can't be edited once responses
  exist, so results stay consistent.
- Set `JWT_SECRET` to a long random string before deploying. With
  `NODE_ENV=production` the server refuses to start without one and
  marks the cookie `Secure` (HTTPS only).

## Project structure

```
shared/
  validation.js        validation rules shared by server and browser
server/
  index.js             Express app, admin seeding, static files, error handling
  loadEnv.js           reads .env (no dotenv dependency needed)
  asyncHandler.js      forwards async route errors to Express
  db/db.js             JSON-file storage helper
  db/data.json         (created automatically, not committed)
  middleware/auth.js   session cookie, JWT verification, role checks
  middleware/security.js  security headers + same-origin/JSON checks
  middleware/rateLimit.js login lockout and per-IP limits
  routes/auth.js       register / login / logout / me / session
  routes/forms.js      admin form CRUD + student form listing
  routes/responses.js  submit feedback + view aggregated results
public/
  index.html           log in / create account
  student.html         student dashboard
  form.html            fill out a form
  admin.html           admin dashboard + form builder
  results.html         results for one form
  css/style.css        design system (tokens, light/dark themes, components)
  js/theme.js          applies the saved theme before first paint
  js/api.js            fetch wrapper + session helpers
  js/ui.js             icons, header, toasts, dialogs, field errors
  js/pages/*.js        one script per page
```

## API

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | anyone | create a student account (`name, email, password, confirmPassword`) |
| POST | `/api/auth/login` | anyone | log in (`email, password, remember?`) |
| POST | `/api/auth/logout` | anyone | end the session |
| GET | `/api/auth/me` | logged in | current user (401 if not logged in) |
| GET | `/api/auth/session` | anyone | current user or `null` |
| GET | `/api/forms` | logged in | admins: their forms + counts; students: open forms |
| GET | `/api/forms/:id` | logged in | one form |
| POST | `/api/forms` | admin | create a form |
| PUT | `/api/forms/:id` | admin | edit title/description/questions, open/close |
| DELETE | `/api/forms/:id` | admin | delete a form and its responses |
| POST | `/api/forms/:id/responses` | student | submit answers |
| GET | `/api/forms/:id/responses` | admin | aggregated, anonymous results |

## How data is modeled

- **User:** `{ id, name, email, passwordHash, role: 'student'|'admin', createdAt }`
- **Form:** `{ id, title, description, questions: [{ id, type, label, options? }], isActive, createdBy, createdAt }`
  - question `type` is one of `rating` (1–5), `choice` (pick one of
    `options`), or `text` (free response)
- **Response:** `{ id, formId, studentId, answers: { [questionId]: value }, submittedAt }`

## Using a real database instead of the JSON file

The JSON file in `server/db/db.js` is deliberately isolated behind
three functions: `load()`, `save(data)`, and `withData(fn)`. To swap
in SQLite/Postgres/MySQL for a production version, replace the
contents of that one file with equivalent database calls. The
routes in `server/routes/` don't need to change as long as they get
back the same `{ users, forms, responses }` shape.

## Notes for presenting this project

- The one-JSON-file storage keeps the project easy to run on any lab
  machine with no setup, and easy to inspect (`server/db/data.json`)
  when demonstrating how data is stored. Call this out as a
  simplification if your rubric expects a real database.
- Login lockouts and rate limits are kept in memory, so they reset when
  the server restarts. A multi-server deployment would keep them in a
  shared store such as Redis.
- There is no self-service password reset (it would need an email
  service); the login page tells students to contact the administrator.
