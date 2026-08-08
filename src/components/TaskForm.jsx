import { useState } from "react";

const STATUS_LABELS = {
  todo: "To Do",
  "in-progress": "In Progress",
  done: "Done",
};

const PRIORITY_OPTIONS = [
  { value: 0, label: "None" },
  { value: 1, label: "Low" },
  { value: 2, label: "Medium" },
  { value: 3, label: "High" },
];

const emptyForm = { title: "", duration: "", status: "todo", priority: 0 };

function minutesToHm(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}.${String(m).padStart(2, "0")}`;
}

function hmToMinutes(value) {
  const parts = String(value).trim().split(".");
  const h = parseInt(parts[0], 10) || 0;
  const m = Math.min(parseInt(parts[1] || "0", 10) || 0, 59);
  return h * 60 + m;
}

export default function TaskForm({ onSubmit, onCancel, initial }) {
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    ...initial,
    duration: initial?.duration ? minutesToHm(Number(initial.duration)) : "",
  }));
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
    const durationText = String(form.duration).trim();
    const duration = durationText ? hmToMinutes(durationText) : 0;
    if (durationText && duration <= 0) {
      setError("Please enter a valid duration");
      return;
    }
    setError("");
    onSubmit({
      ...form,
      title: form.title.trim(),
      duration,
    });
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
          type="text"
          name="duration"
          value={form.duration}
          onChange={handleChange}
          placeholder="e.g. 1.30"
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

      <label>
        Priority
        <div className="status-selector">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`status-btn prio-${opt.value} ${form.priority === opt.value ? "active" : ""}`}
              onClick={() => setForm((prev) => ({ ...prev, priority: opt.value }))}
            >
              {opt.label}
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
