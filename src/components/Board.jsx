import { useState, useCallback, useEffect } from "react";
import useTasks from "../hooks/useTasks";
import TaskForm from "./TaskForm";

const COLUMNS = [
  { key: "todo", label: "To Do", css: "col-todo" },
  { key: "in-progress", label: "In Progress", css: "col-progress" },
  { key: "done", label: "Done", css: "col-done" },
];

const DONE_DELETE_MS = 30000;

const PRIORITY_LABELS = {
  0: "None",
  1: "Low",
  2: "Medium",
  3: "High",
};

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatCountdown(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mmss = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

export default function Board({ user, onLogout }) {
  const { tasks, loading, addTask, updateTask, deleteTask, deleteAllTasks } =
    useTasks(onLogout);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [defaultStatus, setDefaultStatus] = useState("todo");
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("task-scheduler-theme") || "dark",
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("task-scheduler-theme", theme);
  }, [theme]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

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

  function handleDeleteAllClick() {
    if (tasks.length === 0) {
      setDeleteError("There are no tasks to delete");
      return;
    }
    setDeleteError("");
    setConfirmDeleteAll(true);
  }

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
    updateTask(Number(taskId), { status: newStatus });
  }

  const query = search.trim().toLowerCase();
  const visibleTasks = query
    ? tasks.filter((t) => t.title.toLowerCase().includes(query))
    : tasks;

  const sortedByPriority = (list) =>
    list.slice().sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const stats = {
    total: tasks.length,
    inProgress: tasks.filter((t) => t.status === "in-progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Task Scheduler</h1>
        <div className="header-actions">
          <span className="user-chip">{user.username}</span>
          <button
            className="theme-btn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          <button className="btn-secondary" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      {loading ? (
        <div className="auth-loading">Loading tasks...</div>
      ) : (
        <div className="board-wrap">
          <div className="board-toolbar">
            <input
              className="search-input"
              type="search"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="kanban">
            {COLUMNS.map((col) => {
              const colTasks = sortedByPriority(
                visibleTasks.filter((t) => t.status === col.key),
              );
              return (
                <div
                  key={col.key}
                  className={`kanban-col ${col.css}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData("text/plain");
                    if (taskId) handleDrop(taskId, col.key);
                  }}
                >
                  <div className="kanban-col-header">
                    <span>{col.label}</span>
                    <span className="kanban-count">{colTasks.length}</span>
                  </div>
                  <div className="kanban-col-body">
                    {colTasks.map((task) => {
                      const overdue =
                        task.status === "in-progress" &&
                        task.duration &&
                        task.inProgressAt &&
                        now - task.inProgressAt >= task.duration * 60000;
                      return (
                        <button
                          key={task.id}
                          className={`task-card status-${task.status}${overdue ? " overdue" : ""}`}
                          draggable="true"
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", task.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onClick={() => handleTaskClick(task)}
                        >
                          <span className="task-title">{task.title}</span>
                          {task.priority ? (
                            <span className={`priority-badge prio-${task.priority}`}>
                              {PRIORITY_LABELS[task.priority]}
                            </span>
                          ) : null}
                          {task.duration ? (
                            <span className="task-duration">
                              {formatDuration(task.duration)}
                            </span>
                          ) : null}
                          {task.status === "done" && task.doneAt && (
                            <span className="task-countdown">
                              deleting in{" "}
                              {Math.max(
                                0,
                                Math.ceil(
                                  (task.doneAt + DONE_DELETE_MS - now) / 1000,
                                ),
                              )}
                              s
                            </span>
                          )}
                          {task.status === "in-progress" &&
                            task.duration &&
                            task.inProgressAt && (
                              <span className="task-timer">
                                {formatCountdown(
                                  Math.max(
                                    0,
                                    Math.floor(
                                      task.duration * 60 -
                                        (now - task.inProgressAt) / 1000,
                                    ),
                                  ),
                                )}
                              </span>
                            )}
                        </button>
                      );
                    })}
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
        </div>
      )}

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
                      priority: editingTask.priority,
                    }
                  : { title: "", status: defaultStatus, priority: 0 }
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

      <div className="delete-all-wrap">
        <button
          className="btn-danger delete-all-btn"
          onClick={handleDeleteAllClick}
        >
          Delete All Tasks
        </button>
        {deleteError && <p className="delete-error">{deleteError}</p>}
      </div>

      {confirmDeleteAll && (
        <div
          className="modal-overlay"
          onClick={() => setConfirmDeleteAll(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete All Tasks?</h3>
            <p className="confirm-text">
              Are you sure? This will permanently remove every task.
            </p>
            <div className="form-actions">
              <button
                className="btn-danger"
                onClick={() => {
                  deleteAllTasks();
                  setConfirmDeleteAll(false);
                }}
              >
                Delete All
              </button>
              <button
                className="btn-secondary"
                onClick={() => setConfirmDeleteAll(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <span>{stats.total} tasks</span>
        <span>{stats.inProgress} in progress</span>
        <span>{stats.done} completed</span>
        {query && <span>showing {visibleTasks.length} results</span>}
      </footer>
    </div>
  );
}
