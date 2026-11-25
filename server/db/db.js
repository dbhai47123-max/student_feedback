// Lightweight JSON-file database.
// No native modules required, so `npm install` never fails on a
// student lab machine that doesn't have build tools set up.
// For a real production deployment, swap this out for a real
// database (Postgres/MySQL/SQLite) behind the same function names.

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

const DEFAULT_DATA = {
  users: [],
  forms: [],
  responses: []
};

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('Could not parse data.json, resetting to defaults.', err);
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
    return { ...DEFAULT_DATA };
  }
}

function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Simple in-process lock so two requests can't interleave writes
// and clobber each other. Good enough for a coursework project.
let writeChain = Promise.resolve();
function withData(fn) {
  writeChain = writeChain.then(async () => {
    const data = load();
    const result = await fn(data);
    save(data);
    return result;
  });
  return writeChain;
}

module.exports = { load, save, withData };
