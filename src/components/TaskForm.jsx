import { useState } from "react";

const STATUS_LABELS = {
  todo: "To Do",
  "in-progress": "In Progress",
  done: "Done",
};

const emptyForm = { title: "", duration: 1, status: "todo" };

export default function TaskForm({ onSubmit, onCancel, initial }) {
  const [form, setForm] = useState(initial || emptyForm);
  const [error, setError] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Please enter a task title");
      return;
    }
    setError("");
    onSubmit({ ...form, title: form.title.trim() });
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <h3>{initial ? "Edit Task" : "New Task"}</h3>

      <label>
        Title
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="e.g. Shoot scene 1"
          autoFocus
        />
      </label>

      <label>
        Duration (hours.minutes)
        <input
          type="number"
          name="duration"
          value={form.duration}
          onChange={handleChange}
          min="0.5"
          step="0.5"
        />
      </label>

      <label>
        Status
        <div className="status-selector">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`status-btn status-${key} ${form.status === key ? "active" : ""}`}
              onClick={() => setForm((prev) => ({ ...prev, status: key }))}
            >
              {label}
            </button>
          ))}
        </div>
      </label>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="submit" className="btn-primary">
          {initial ? "Save" : "Add"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
