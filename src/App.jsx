import { useState, useCallback } from 'react';
import useTasks from './hooks/useTasks';
import TaskForm from './components/TaskForm';

const COLUMNS = [
  { key: 'todo', label: 'To Do', css: 'col-todo' },
  { key: 'in-progress', label: 'In Progress', css: 'col-progress' },
  { key: 'done', label: 'Done', css: 'col-done' },
];

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export default function App() {
  const { tasks, addTask, updateTask, deleteTask } = useTasks();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [defaultStatus, setDefaultStatus] = useState('todo');

  function handleAddRequest(status) {
    setEditingTask(null);
    setDefaultStatus(status);
    setShowForm(true);
  }

  function handleTaskClick(task) {
    setEditingTask(task);
    setDefaultStatus(task.status);
    setShowForm(true);
  }

  const handleSubmit = useCallback(
    (data) => {
      if (editingTask) {
        updateTask(editingTask.id, data);
      } else {
        addTask(data);
      }
      setShowForm(false);
      setEditingTask(null);
    },
    [editingTask, addTask, updateTask],
  );

  function handleCancel() {
    setShowForm(false);
    setEditingTask(null);
  }

  function handleDelete() {
    if (editingTask) {
      deleteTask(editingTask.id);
      setShowForm(false);
      setEditingTask(null);
    }
  }

  function handleDrop(taskId, newStatus) {
    updateTask(taskId, { status: newStatus });
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Task Scheduler</h1>
      </header>

      <div className="kanban">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div
              key={col.key}
              className={`kanban-col ${col.css}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData('text/plain');
                if (taskId) handleDrop(taskId, col.key);
              }}
            >
              <div className="kanban-col-header">
                <span>{col.label}</span>
                <span className="kanban-count">{colTasks.length}</span>
              </div>
              <div className="kanban-col-body">
                {colTasks.map((task) => (
                  <button
                    key={task.id}
                    className={`task-card status-${task.status}`}
                    draggable="true"
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', task.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onClick={() => handleTaskClick(task)}
                  >
                    <span className="task-title">{task.title}</span>
                    {task.duration && <span className="task-duration-label">time</span>}
                    {task.duration && <span className="task-duration">{formatDuration(task.duration)}</span>}
                  </button>
                ))}
                <button
                  className="kanban-add"
                  onClick={() => handleAddRequest(col.key)}
                >
                  + Add Task
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <TaskForm
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              initial={
                editingTask
                  ? {
                      title: editingTask.title,
                      duration: editingTask.duration,
                      status: editingTask.status,
                    }
                  : { title: '', duration: 60, status: defaultStatus }
              }
            />
            {editingTask && (
              <div className="edit-actions">
                <button className="btn-danger" onClick={handleDelete}>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="app-footer">
        <span>{tasks.length} tasks</span>
        <span>{tasks.filter((t) => t.status === 'done').length} completed</span>
      </footer>
    </div>
  );
}
