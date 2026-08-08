import { useState, useCallback, useEffect, useRef } from 'react';

const STORAGE_KEY = 'task-scheduler-tasks';
const DONE_DELETE_MS = 30000;

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const tasks = raw ? JSON.parse(raw) : [];
    return tasks.map((t) => ({
      ...t,
      status: t.status === 'pending' ? 'todo' : t.status,
      duration:
        t.duration <= 10
          ? Math.round(Number(t.duration) * 60)
          : t.duration,
    }));
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save tasks:', e);
  }
}

let nextId = Date.now();
function generateId() {
  return String(++nextId);
}

export default function useTasks() {
  const [tasks, setTasks] = useState(loadTasks);
  const scheduledDone = useRef(new Set());
  const timers = useRef(new Set());

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    };
  }, []);

  useEffect(() => {
    let dirty = false;
    const stamp = Date.now();
    const next = tasks.map((t) => {
      let task = t;
      if (t.status === 'done' && !t.doneAt) {
        dirty = true;
        task = { ...task, doneAt: stamp };
      } else if (t.status !== 'done' && t.doneAt != null) {
        dirty = true;
        const { doneAt, ...rest } = task;
        task = rest;
      }
      if (t.status === 'in-progress' && !t.inProgressAt) {
        dirty = true;
        task = { ...task, inProgressAt: stamp };
      } else if (t.status !== 'in-progress' && t.inProgressAt != null) {
        dirty = true;
        const { inProgressAt, ...rest } = task;
        task = rest;
      }
      return task;
    });
    if (dirty) setTasks(next);
  }, [tasks]);

  useEffect(() => {
    tasks.forEach((t) => {
      if (t.status !== 'done' || !t.doneAt) return;
      const remaining = t.doneAt + DONE_DELETE_MS - Date.now();
      if (remaining <= 0) {
        scheduledDone.current.delete(t.id);
        setTasks((prev) => prev.filter((x) => x.id !== t.id));
        return;
      }
      if (scheduledDone.current.has(t.id)) return;
      scheduledDone.current.add(t.id);
      const timer = setTimeout(() => {
        scheduledDone.current.delete(t.id);
        timers.current.delete(timer);
        setTasks((prev) =>
          prev.filter((x) => !(x.id === t.id && x.status === 'done')),
        );
      }, remaining);
      timers.current.add(timer);
    });
  }, [tasks]);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const addTask = useCallback((task) => {
    const newTask = { ...task, id: generateId(), status: task.status || 'todo' };
    setTasks((prev) => [...prev, newTask]);
    return newTask;
  }, []);

  const updateTask = useCallback((id, updates) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    );
  }, []);

  const deleteTask = useCallback((id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const STATUS_CYCLE = { todo: 'in-progress', 'in-progress': 'done', done: 'todo' };

  const toggleStatus = useCallback((id) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: STATUS_CYCLE[t.status] || 'todo' }
          : t,
      ),
    );
  }, []);

  return { tasks, addTask, updateTask, deleteTask, toggleStatus };
}
