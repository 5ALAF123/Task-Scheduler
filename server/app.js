import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ensureSchema, getUserByName, getUserById, createUser, listTasks, getTask, createTask, updateTask, deleteTask, deleteAllTasks } from './db.js';

const isProd = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET;
const DONE_DELETE_MS = 30000;
const VALID_STATUSES = ['todo', 'in-progress', 'done'];
const COOKIE_NAME = 'ts_token';

if (isProd && !JWT_SECRET) {
  throw new Error('JWT_SECRET env var is required in production. Set it in Vercel project settings.');
}

ensureSchema().catch((e) => console.error('Schema init failed:', e.message));

const app = express();
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode}`);
  });
  next();
});

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Server error' });
});

function signAndSetCookie(res, userId) {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Not logged in' });
  }
}

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

function createApiRouter() {
  const router = express.Router();

  router.post('/register', loginRateLimit, wrap(async (req, res) => {
    const username = String((req.body && req.body.username) || '').trim();
    const password = String((req.body && req.body.password) || '');

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 3-20 characters.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    if (await getUserByName(username)) {
      return res.status(409).json({ error: 'Username already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = await createUser(username, passwordHash);
    loginAttempts.delete(username);
    signAndSetCookie(res, id);
    res.json({ user: { id, username } });
  }));

  router.post('/login', loginRateLimit, wrap(async (req, res) => {
    const username = String((req.body && req.body.username) || '').trim();
    const password = String((req.body && req.body.password) || '');

    const user = await getUserByName(username);
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    loginAttempts.delete(username);
    signAndSetCookie(res, user.id);
    res.json({ user: { id: Number(user.id), username: user.username } });
  }));

  router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  });

  router.get('/me', wrap(async (req, res) => {
    const token = req.cookies && req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Not logged in' });
    let userId;
    try {
      userId = jwt.verify(token, JWT_SECRET).userId;
    } catch {
      return res.status(401).json({ error: 'Not logged in' });
    }
    const user = await getUserById(userId);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    res.json({ user: { id: Number(user.id), username: user.username } });
  }));

  router.get('/tasks', requireAuth, wrap(async (req, res) => {
    const tasks = await listTasks(req.userId);
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
        await updateTask(row.id, { status: 'done', done_at: now, in_progress_at: null });
        row = { ...row, status: 'done', done_at: now, in_progress_at: null };
      }
      if (row.status === 'done' && row.done_at && now - row.done_at >= DONE_DELETE_MS) {
        await deleteTask(row.id);
        continue;
      }
      result.push(mapTask(row));
    }

    res.json({ tasks: result });
  }));

  router.post('/tasks', requireAuth, wrap(async (req, res) => {
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

    const id = await createTask(req.userId, title, duration, status);
    res.json({ task: mapTask(await getTask(id)) });
  }));

  router.put('/tasks/:id', requireAuth, wrap(async (req, res) => {
    const task = await getTask(Number(req.params.id));
    if (!task || task.user_id !== req.userId) {
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

    await updateTask(task.id, updates);
    res.json({ task: mapTask(await getTask(task.id)) });
  }));

  router.delete('/tasks/:id', requireAuth, wrap(async (req, res) => {
    const task = await getTask(Number(req.params.id));
    if (!task || task.user_id !== req.userId) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    await deleteTask(task.id);
    res.json({ ok: true });
  }));

  router.delete('/tasks', requireAuth, wrap(async (req, res) => {
    await deleteAllTasks(req.userId);
    res.json({ ok: true });
  }));

  return router;
}

const api = createApiRouter();
app.use('/api', api);
app.use(api);

export default app;
