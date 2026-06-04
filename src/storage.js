import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve('.data');
const dbPath = path.join(dataDir, 'db.json');

function ensureDb() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(
      dbPath,
      JSON.stringify(
        { todos: {}, notes: {}, standups: {}, config: {}, nugasThreads: {}, mb01Threads: {} },
        null,
        2
      ),
      'utf8'
    );
  }
}

export function readDb() {
  ensureDb();
  const raw = fs.readFileSync(dbPath, 'utf8');
  return JSON.parse(raw);
}

export function writeDb(next) {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify(next, null, 2), 'utf8');
}

export function withDb(mutator) {
  const db = readDb();
  const next = mutator(structuredClone(db)) ?? db;
  writeDb(next);
  return next;
}

function structuredClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

