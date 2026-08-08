import pg from 'pg';

const { Pool } = pg;

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

const needsSsl = process.env.NODE_ENV === 'production' || !/localhost|127\.0\.0\.1/.test(connectionString || '');

export const pool = new Pool({
  connectionString,
  max: 5,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
});

export async function ensureSchema() {
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Set it in .env (local) or Vercel env vars.');
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      duration INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'todo',
      priority INTEGER NOT NULL DEFAULT 0,
      in_progress_at BIGINT,
      done_at BIGINT,
      created_at BIGINT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
  `);

  await pool.query(`
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;
  `);
}

export async function getUserByName(username) {
  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return rows[0];
}

export async function getUserById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0];
}

export async function createUser(username, passwordHash) {
  const { rows } = await pool.query(
    'INSERT INTO users (username, password_hash, created_at) VALUES ($1, $2, $3) RETURNING id',
    [username, passwordHash, Date.now()],
  );
  return Number(rows[0].id);
}

export async function listTasks(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at ASC',
    [userId],
  );
  return rows;
}

export async function getTask(id) {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  return rows[0];
}

export async function createTask(userId, title, duration, status, priority = 0) {
  const { rows } = await pool.query(
    'INSERT INTO tasks (user_id, title, duration, status, priority, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [userId, title, duration, status, priority, Date.now()],
  );
  return Number(rows[0].id);
}

export async function updateTask(id, updates) {
  const allowed = ['title', 'duration', 'status', 'priority', 'in_progress_at', 'done_at'];
  const entries = Object.entries(updates).filter(([k]) => allowed.includes(k));
  if (entries.length === 0) return;
  const sets = entries.map(([k], i) => `${k} = $${i + 1}`).join(', ');
  const values = entries.map(([, v]) => v);
  await pool.query(
    `UPDATE tasks SET ${sets} WHERE id = $${entries.length + 1}`,
    [...values, id],
  );
}

export async function deleteTask(id) {
  await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
}

export async function deleteAllTasks(userId) {
  await pool.query('DELETE FROM tasks WHERE user_id = $1', [userId]);
}
