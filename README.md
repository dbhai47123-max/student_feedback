# Student Feedback System

A full-stack feedback system for a university course: students submit
feedback on configurable forms (course feedback, facility feedback,
event feedback — anything an admin sets up), and admins review
anonymous, aggregated results.

## Stack

- **Backend:** Node.js + Express, JWT auth, bcrypt password hashing
- **Storage:** a JSON file (`server/db/data.json`), auto-created on
  first run — no database server to install. See "Using a real
  database" below to swap in Postgres/MySQL/SQLite later.
- **Frontend:** plain HTML/CSS/JS, no build step

## Features

- **Students:** register/log in, see open feedback forms, submit
  answers (rating 1–5, multiple choice, or short text), one
  submission per form.
- **Admins:** log in with a seeded admin account, build forms with a
  question builder (any mix of question types), open/close forms,
  view aggregated results (averages, distributions, anonymized text
  answers), delete forms.
- Feedback is anonymous to admins: responses are never shown with a
  student's name attached, only used server-side to block duplicate
  submissions.

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
register their own accounts from the same page.

To change the admin credentials or port, copy `.env.example` to
`.env` and edit it (or just set the environment variables before
`npm start`).

## Project structure

```
server/
  index.js            Express app, admin seeding, static file serving
  db/db.js            JSON-file storage helper
  db/data.json         (created automatically — not committed)
  middleware/auth.js   JWT verification + role checks
  routes/auth.js       register / login
  routes/forms.js      admin form CRUD + student form listing
  routes/responses.js  submit feedback + view aggregated results
public/
  index.html           login / register
  student.html         list of open forms
  form.html            fill out a form
  admin.html           admin dashboard + form builder
  results.html         aggregated results for one form
  css/style.css
  js/api.js            shared fetch/auth helper
```

## How data is modeled

- **User:** `{ id, name, email, passwordHash, role: 'student'|'admin' }`
- **Form:** `{ id, title, description, questions: [{ id, type, label, options? }], isActive, createdBy }`
  - question `type` is one of `rating` (1–5), `choice` (pick one of
    `options`), or `text` (free response)
- **Response:** `{ id, formId, studentId, answers: { [questionId]: value }, submittedAt }`

## Using a real database instead of the JSON file

The JSON file in `server/db/db.js` is deliberately isolated behind
three functions: `load()`, `save(data)`, and `withData(fn)`. To swap
in SQLite/Postgres/MySQL for a production version, replace the
contents of that one file with equivalent database calls — the
routes in `server/routes/` don't need to change as long as they get
back the same `{ users, forms, responses }` shape.

## Notes for presenting this project

- The one-JSON-file storage keeps the project easy to run on any lab
  machine with no setup, and easy to inspect (`server/db/data.json`)
  when demonstrating how data is stored — but call this out as a
  simplification if your rubric expects a real database.
- Passwords are hashed with bcrypt; they're never stored or sent in
  plain text after registration.
- Sessions use a JWT stored in the browser's `localStorage`; a real
  production app would generally also add refresh tokens and CSRF
  protection.
