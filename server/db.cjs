const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(path.join(DATA_DIR, 'app.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'todo',
    in_progress_at INTEGER,
    done_at INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
`);

function getUserByName(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function createUser(username, passwordHash) {
  const info = db
    .prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)')
    .run(username, passwordHash, Date.now());
  return Number(info.lastInsertRowid);
}

function listTasks(userId) {
  return db
    .prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at ASC')
    .all(userId);
}

function getTask(id) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

function createTask(userId, title, duration, status) {
  const info = db
    .prepare(
      'INSERT INTO tasks (user_id, title, duration, status, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(userId, title, duration, status, Date.now());
  return Number(info.lastInsertRowid);
}

function updateTask(id, updates) {
  const allowed = ['title', 'duration', 'status', 'in_progress_at', 'done_at'];
  const entries = Object.entries(updates).filter(([k]) => allowed.includes(k));
  if (entries.length === 0) return;
  const sets = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);
  db.prepare(`UPDATE tasks SET ${sets} WHERE id = ?`).run(...values, id);
}

function deleteTask(id) {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

function deleteAllTasks(userId) {
  db.prepare('DELETE FROM tasks WHERE user_id = ?').run(userId);
}

module.exports = {
  getUserByName,
  getUserById,
  createUser,
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  deleteAllTasks,
};
