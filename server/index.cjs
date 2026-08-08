const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db.cjs');

const PORT = process.env.PORT || 3001;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const DONE_DELETE_MS = 30000;
const VALID_STATUSES = ['todo', 'in-progress', 'done'];

const app = express();
app.use(helmet());
app.use(express.json());

app.set('trust proxy', 1);

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

const loginAttempts = new Map();
function loginRateLimit(req, res, next) {
  const key = String((req.body && req.body.username) || req.ip || 'ip');
  const now = Date.now();
  const rec = loginAttempts.get(key);
  if (rec && now - rec.start < 15 * 60 * 1000 && rec.count >= 10) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }
  if (!rec || now - rec.start > 15 * 60 * 1000) {
    loginAttempts.set(key, { count: 1, start: now });
  } else {
    rec.count += 1;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  next();
}

function mapTask(t) {
  return {
    id: t.id,
    title: t.title,
    duration: t.duration,
    status: t.status,
    inProgressAt: t.in_progress_at,
    doneAt: t.done_at,
  };
}

app.post('/api/register', loginRateLimit, async (req, res) => {
  const username = String((req.body && req.body.username) || '').trim();
  const password = String((req.body && req.body.password) || '');

  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: 'Username must be 3-20 characters.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (db.getUserByName(username)) {
    return res.status(409).json({ error: 'Username already taken.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = db.createUser(username, passwordHash);
  req.session.userId = id;
  loginAttempts.delete(username);
  res.json({ user: { id, username } });
});

app.post('/api/login', loginRateLimit, async (req, res) => {
  const username = String((req.body && req.body.username) || '').trim();
  const password = String((req.body && req.body.password) || '');

  const user = db.getUserByName(username);
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  req.session.userId = user.id;
  loginAttempts.delete(username);
  res.json({ user: { id: user.id, username: user.username } });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  const user = req.session.userId && db.getUserById(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  res.json({ user: { id: user.id, username: user.username } });
});

app.get('/api/tasks', requireAuth, (req, res) => {
  const tasks = db.listTasks(req.session.userId);
  const now = Date.now();
  const result = [];

  for (const t of tasks) {
    let row = t;
    if (
      row.status === 'in-progress' &&
      row.duration > 0 &&
      row.in_progress_at &&
      now - row.in_progress_at >= row.duration * 60000
    ) {
      db.updateTask(row.id, { status: 'done', done_at: now, in_progress_at: null });
      row = { ...row, status: 'done', done_at: now, in_progress_at: null };
    }
    if (row.status === 'done' && row.done_at && now - row.done_at >= DONE_DELETE_MS) {
      db.deleteTask(row.id);
      continue;
    }
    result.push(mapTask(row));
  }

  res.json({ tasks: result });
});

app.post('/api/tasks', requireAuth, (req, res) => {
  const title = String((req.body && req.body.title) || '').trim();
  const duration = Number((req.body && req.body.duration) || 0) || 0;
  const status = VALID_STATUSES.includes(req.body && req.body.status)
    ? req.body.status
    : 'todo';

  if (!title) {
    return res.status(400).json({ error: 'Title is required.' });
  }
  if (duration < 0) {
    return res.status(400).json({ error: 'Invalid duration.' });
  }

  const id = db.createTask(req.session.userId, title, duration, status);
  res.json({ task: mapTask(db.getTask(id)) });
});

app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const task = db.getTask(Number(req.params.id));
  if (!task || task.user_id !== req.session.userId) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  const updates = {};
  if (req.body.title !== undefined) {
    const title = String(req.body.title).trim();
    if (!title) return res.status(400).json({ error: 'Title is required.' });
    updates.title = title;
  }
  if (req.body.duration !== undefined) {
    const duration = Number(req.body.duration) || 0;
    if (duration < 0) return res.status(400).json({ error: 'Invalid duration.' });
    updates.duration = duration;
  }
  if (req.body.status !== undefined) {
    if (!VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    updates.status = req.body.status;
  }

  if (updates.status === 'done') {
    updates.done_at = Date.now();
    updates.in_progress_at = null;
  } else if (updates.status === 'in-progress') {
    updates.in_progress_at = Date.now();
    updates.done_at = null;
  } else if (updates.status) {
    updates.in_progress_at = null;
    updates.done_at = null;
  }

  db.updateTask(task.id, updates);
  res.json({ task: mapTask(db.getTask(task.id)) });
});

app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  const task = db.getTask(Number(req.params.id));
  if (!task || task.user_id !== req.session.userId) {
    return res.status(404).json({ error: 'Task not found.' });
  }
  db.deleteTask(task.id);
  res.json({ ok: true });
});

app.delete('/api/tasks', requireAuth, (req, res) => {
  db.deleteAllTasks(req.session.userId);
  res.json({ ok: true });
});

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Task Scheduler server running on http://localhost:${PORT}`);
});
