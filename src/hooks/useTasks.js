import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'task-scheduler-tasks';

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const tasks = raw ? JSON.parse(raw) : [];
    return tasks.map((t) => ({
      ...t,
      status: t.status === 'pending' ? 'todo' : t.status,
      duration: t.duration > 10 ? Math.round(t.duration / 60 * 10) / 10 : t.duration,
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
