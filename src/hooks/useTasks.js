import { useState, useCallback, useEffect, useRef } from 'react';

const DONE_DELETE_MS = 30000;

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

export default function useTasks(onAuthError) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const scheduledDone = useRef(new Set());
  const scheduledProgress = useRef(new Set());
  const timers = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    request('/api/tasks')
      .then((data) => {
        if (!cancelled) setTasks(data.tasks || []);
      })
      .catch((err) => {
        if (err.message === 'Not logged in' && onAuthError) onAuthError();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    };
  }, [onAuthError]);

  useEffect(() => {
    tasks.forEach((t) => {
      if (t.status === 'done' && t.doneAt) {
        const remaining = t.doneAt + DONE_DELETE_MS - Date.now();
        if (remaining <= 0) {
          scheduledDone.current.delete(t.id);
          deleteTask(t.id);
          return;
        }
        if (scheduledDone.current.has(t.id)) return;
        scheduledDone.current.add(t.id);
        const timer = setTimeout(() => {
          scheduledDone.current.delete(t.id);
          timers.current.delete(timer);
          deleteTask(t.id);
        }, remaining);
        timers.current.add(timer);
      }
      if (t.status === 'in-progress' && t.duration && t.inProgressAt) {
        const totalMs = t.duration * 60000;
        const remaining = t.inProgressAt + totalMs - Date.now();
        if (remaining <= 0) {
          scheduledProgress.current.delete(t.id);
          updateTask(t.id, { status: 'done' });
          return;
        }
        if (scheduledProgress.current.has(t.id)) return;
        scheduledProgress.current.add(t.id);
        const timer = setTimeout(() => {
          scheduledProgress.current.delete(t.id);
          timers.current.delete(timer);
          updateTask(t.id, { status: 'done' });
        }, remaining);
        timers.current.add(timer);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const addTask = useCallback(async (task) => {
    const data = await request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
    setTasks((prev) => [...prev, data.task]);
    return data.task;
  }, []);

  const updateTask = useCallback(async (id, updates) => {
    const data = await request(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    setTasks((prev) => prev.map((t) => (t.id === data.task.id ? data.task : t)));
    return data.task;
  }, []);

  const deleteTask = useCallback(async (id) => {
    await request(`/api/tasks/${id}`, { method: 'DELETE' });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const deleteAllTasks = useCallback(async () => {
    await request('/api/tasks', { method: 'DELETE' });
    setTasks([]);
  }, []);

  return { tasks, loading, addTask, updateTask, deleteTask, deleteAllTasks };
}
