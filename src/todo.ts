import "./todo.css";

import { LogicalSize } from "@tauri-apps/api/dpi";
import { emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getLocale, t } from "./i18n";
import {
  loadTodos,
  normalizeTodo,
  saveTodos,
  todoEventName,
  type TodoPriority,
} from "./todo-store";

type TodoFilter = "all" | "active" | "done";

const priorityOrder: TodoPriority[] = ["normal", "important", "urgent"];
let todos = loadTodos();
let activeFilter: TodoFilter = "all";
let confirmedReminder = "";
let selectedCalendarDate = new Date();
let calendarMonth = new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth(), 1);
const todoWindow = getCurrentWindow();

const pad2 = (value: number) => String(value).padStart(2, "0");
const localDateValue = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
})[character] ?? character);

const formatReminder = (value: string) => value
  ? new Date(value).toLocaleString(getLocale(), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  : t("todo.noReminder");

const priorityLabel = (priority: TodoPriority) => t(`todo.priority${priority[0].toUpperCase()}${priority.slice(1)}`);

document.body.innerHTML = `
  <main class="todo-window">
    <header class="todo-header" data-tauri-drag-region>
      <h1 data-tauri-drag-region>${t("todo.title")}</h1>
      <span class="todo-count" aria-live="polite" data-tauri-drag-region>
        <strong id="active-count">0</strong>
        <span>${t("todo.remainingUnit")}</span>
      </span>
      <button id="close-todo" class="todo-window-close" type="button" aria-label="${t("accessibility.closeTodo")}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
      </button>
    </header>

    <div class="todo-app">
      <section class="composer" aria-label="${t("todo.createTitle")}">
        <div class="composer-row">
          <label class="sr-only" for="todo-title">${t("todo.placeholder")}</label>
          <input id="todo-title" class="todo-input" placeholder="${t("todo.placeholder")}" autocomplete="off" />

          <div id="reminder-control" class="compact-control reminder-control">
            <button id="reminder-button" class="compact-control-button" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="reminder-popover" aria-label="${t("todo.remindAt")}" title="${t("todo.remindAt")}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" /></svg>
            </button>
          </div>

          <input id="todo-priority" type="hidden" value="normal" />
          <button id="priority-button" class="compact-control-button" data-priority="normal" type="button">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4m0 1h10l-2 3 2 3H6" /></svg>
          </button>

          <button id="add-todo" class="add-todo" type="button">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            <span>${t("todo.add")}</span>
          </button>
        </div>
        <p class="input-error" id="title-error" role="alert" hidden>${t("todo.titleRequired")}</p>

        <section id="reminder-popover" class="reminder-popover" role="dialog" aria-label="${t("todo.calendarLabel")}" hidden>
          <header class="calendar-header">
            <button id="calendar-previous" type="button" aria-label="${t("todo.previousMonth")}" title="${t("todo.previousMonth")}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
            </button>
            <strong id="calendar-month"></strong>
            <button id="calendar-next" type="button" aria-label="${t("todo.nextMonth")}" title="${t("todo.nextMonth")}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
            </button>
          </header>
          <div id="calendar-weekdays" class="calendar-weekdays" aria-hidden="true"></div>
          <div id="calendar-grid" class="calendar-grid"></div>
          <div class="calendar-footer">
            <div class="time-fields" aria-label="${t("todo.reminderDateTime")}">
              <label><span>${t("todo.hour")}</span><input id="reminder-hour" type="number" min="0" max="23" inputmode="numeric" /></label>
              <span aria-hidden="true">:</span>
              <label><span>${t("todo.minute")}</span><input id="reminder-minute" type="number" min="0" max="59" inputmode="numeric" /></label>
            </div>
            <div class="calendar-actions">
              <button id="reminder-cancel" class="calendar-action cancel" type="button" aria-label="${t("todo.cancelReminder")}" title="${t("todo.cancelReminder")}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
              </button>
              <button id="reminder-confirm" class="calendar-action confirm" type="button" aria-label="${t("todo.confirmReminder")}" title="${t("todo.confirmReminder")}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10" /></svg>
              </button>
            </div>
          </div>
        </section>
      </section>

      <div id="todo-results" class="todo-results" hidden>
        <nav class="todo-filters" aria-label="${t("todo.filtersLabel")}">
          <button class="active" type="button" data-filter="all">${t("todo.filterAll")}</button>
          <button type="button" data-filter="active">${t("todo.filterActive")}</button>
          <button type="button" data-filter="done">${t("todo.filterDone")}</button>
        </nav>
        <section class="todo-list" id="todo-list" aria-live="polite"></section>
      </div>
    </div>
  </main>
`;

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const persist = () => {
  saveTodos(todos);
  void emitTo("main", todoEventName, todos);
};

const updatePriorityButton = (priority: TodoPriority) => {
  const button = byId<HTMLButtonElement>("priority-button");
  const label = `${t("todo.priority")}: ${priorityLabel(priority)}`;
  button.dataset.priority = priority;
  button.title = label;
  button.setAttribute("aria-label", label);
  byId<HTMLInputElement>("todo-priority").value = priority;
};

const updateReminderButton = () => {
  const button = byId<HTMLButtonElement>("reminder-button");
  button.dataset.active = String(Boolean(confirmedReminder));
  button.title = confirmedReminder ? formatReminder(confirmedReminder) : t("todo.remindAt");
  button.setAttribute("aria-label", button.title);
};

const buildReminderValue = () => {
  const hour = Math.max(0, Math.min(23, Number(byId<HTMLInputElement>("reminder-hour").value) || 0));
  const minute = Math.max(0, Math.min(59, Number(byId<HTMLInputElement>("reminder-minute").value) || 0));
  return `${localDateValue(selectedCalendarDate)}T${pad2(hour)}:${pad2(minute)}`;
};

const restoreReminderDraft = (value: string) => {
  const fallback = new Date(Date.now() + 5 * 60_000);
  fallback.setSeconds(0, 0);
  const parsed = value ? new Date(value) : fallback;
  selectedCalendarDate = Number.isNaN(parsed.getTime()) ? fallback : parsed;
  calendarMonth = new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth(), 1);
  byId<HTMLInputElement>("reminder-hour").value = pad2(selectedCalendarDate.getHours());
  byId<HTMLInputElement>("reminder-minute").value = pad2(selectedCalendarDate.getMinutes());
};

const renderCalendar = () => {
  const locale = getLocale();
  byId<HTMLElement>("calendar-month").textContent = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(calendarMonth);
  const sunday = new Date(2024, 0, 7);
  byId<HTMLElement>("calendar-weekdays").innerHTML = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + index);
    return `<span>${new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(day)}</span>`;
  }).join("");

  const firstCell = new Date(calendarMonth);
  firstCell.setDate(1 - firstCell.getDay());
  const todayKey = localDateValue(new Date());
  const selectedKey = localDateValue(selectedCalendarDate);
  byId<HTMLElement>("calendar-grid").innerHTML = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstCell);
    day.setDate(firstCell.getDate() + index);
    const key = localDateValue(day);
    const outside = day.getMonth() !== calendarMonth.getMonth();
    return `<button type="button" data-calendar-day="${key}" class="${outside ? "outside " : ""}${key === todayKey ? "today " : ""}${key === selectedKey ? "selected" : ""}" aria-label="${new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(day)}">${day.getDate()}</button>`;
  }).join("");
};

const resizeTodoWindow = () => {
  const calendarOpen = !byId<HTMLElement>("reminder-popover").hidden;
  const targetHeight = calendarOpen ? 420 : todos.length === 0 ? 180 : Math.min(420, 238 + Math.min(2, todos.length) * 70);
  void todoWindow.setSize(new LogicalSize(480, targetHeight));
};

const setReminderPopoverOpen = (open: boolean) => {
  byId<HTMLElement>("reminder-popover").hidden = !open;
  byId<HTMLButtonElement>("reminder-button").setAttribute("aria-expanded", String(open));
  if (open) renderCalendar();
  resizeTodoWindow();
};

const render = () => {
  const visibleTodos = todos.filter((todo) => activeFilter === "all" || (activeFilter === "done" ? todo.done : !todo.done));
  const results = byId<HTMLElement>("todo-results");
  results.hidden = todos.length === 0;
  byId<HTMLElement>("active-count").textContent = String(todos.filter((todo) => !todo.done).length);
  byId<HTMLElement>("todo-list").innerHTML = visibleTodos.map((todo) => `
    <article class="todo-card priority-${todo.priority} ${todo.done ? "done" : ""}">
      <label class="todo-check">
        <input type="checkbox" data-toggle="${todo.id}" ${todo.done ? "checked" : ""} />
        <span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9" /></svg></span>
      </label>
      <div class="todo-content">
        <h2>${escapeHtml(todo.title)}</h2>
        <div class="todo-meta">
          <span class="priority-badge">${priorityLabel(todo.priority)}</span>
          <time>${escapeHtml(formatReminder(todo.remindAt))}</time>
        </div>
      </div>
      <button class="delete-todo" type="button" data-delete="${todo.id}" aria-label="${t("todo.delete")}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5M14 11v5" /></svg>
      </button>
    </article>
  `).join("");

  resizeTodoWindow();
};

const addTodo = () => {
  const titleInput = byId<HTMLInputElement>("todo-title");
  const title = titleInput.value.trim();
  const error = byId<HTMLElement>("title-error");
  if (!title) {
    error.hidden = false;
    titleInput.setAttribute("aria-invalid", "true");
    titleInput.focus();
    return;
  }
  error.hidden = true;
  titleInput.removeAttribute("aria-invalid");
  todos.unshift(normalizeTodo({
    id: crypto.randomUUID(),
    title,
    remindAt: confirmedReminder,
    priority: byId<HTMLInputElement>("todo-priority").value as TodoPriority,
  }));
  titleInput.value = "";
  confirmedReminder = "";
  setReminderPopoverOpen(false);
  updateReminderButton();
  updatePriorityButton("normal");
  persist();
  render();
  titleInput.focus();
};

byId("add-todo").addEventListener("click", addTodo);
byId("close-todo").addEventListener("click", () => void todoWindow.hide());
byId("reminder-button").addEventListener("click", () => {
  restoreReminderDraft(confirmedReminder);
  setReminderPopoverOpen(true);
});
byId("reminder-confirm").addEventListener("click", () => {
  confirmedReminder = buildReminderValue();
  setReminderPopoverOpen(false);
  updateReminderButton();
});
byId("reminder-cancel").addEventListener("click", () => {
  restoreReminderDraft(confirmedReminder);
  setReminderPopoverOpen(false);
  updateReminderButton();
});
byId("calendar-previous").addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
  renderCalendar();
});
byId("calendar-next").addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  renderCalendar();
});
byId("calendar-grid").addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-calendar-day]");
  if (!button?.dataset.calendarDay) return;
  const [year, month, day] = button.dataset.calendarDay.split("-").map(Number);
  selectedCalendarDate = new Date(year, month - 1, day);
  calendarMonth = new Date(year, month - 1, 1);
  renderCalendar();
});
byId("priority-button").addEventListener("click", () => {
  const current = byId<HTMLInputElement>("todo-priority").value as TodoPriority;
  updatePriorityButton(priorityOrder[(priorityOrder.indexOf(current) + 1) % priorityOrder.length]);
});
void listen<string>("todo-window-open", ({ payload }) => {
  document.body.dataset.openDirection = payload === "left" ? "left" : "right";
  const windowSurface = document.querySelector<HTMLElement>(".todo-window");
  if (!windowSurface) return;
  windowSurface.classList.remove("entering");
  void windowSurface.offsetWidth;
  windowSurface.classList.add("entering");
});
byId<HTMLInputElement>("todo-title").addEventListener("keydown", (event) => {
  if (event.key === "Enter") addTodo();
});
byId("todo-list").addEventListener("change", (event) => {
  const id = (event.target as HTMLInputElement).dataset.toggle;
  const todo = todos.find((item) => item.id === id);
  if (!todo) return;
  todo.done = (event.target as HTMLInputElement).checked;
  persist();
  render();
});
byId("todo-list").addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-delete]");
  if (!button?.dataset.delete) return;
  todos = todos.filter((todo) => todo.id !== button.dataset.delete);
  persist();
  render();
});
document.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter as TodoFilter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

void todoWindow.setTitle(t("todo.windowTitle"));
updatePriorityButton("normal");
updateReminderButton();
render();
