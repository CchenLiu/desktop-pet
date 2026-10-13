import "./todo.css";

import { emitTo } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getLocale, t } from "./i18n";
import {
  loadTodos,
  normalizeTodo,
  saveTodos,
  todoEventName,
  type Todo,
  type TodoPriority,
} from "./todo-store";

type TodoFilter = "all" | "active" | "done";

let todos = loadTodos();
let activeFilter: TodoFilter = "all";
const todoWindow = getCurrentWindow();

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

document.body.innerHTML = `
  <main class="todo-window">
    <header class="todo-titlebar" data-tauri-drag-region>
      <span data-tauri-drag-region>${t("todo.windowTitle")}</span>
      <button id="close-todo" class="todo-window-close" type="button" aria-label="${t("accessibility.closeTodo")}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
      </button>
    </header>
    <div class="todo-app">
    <header class="todo-header">
      <div>
        <span class="todo-kicker">${t("todo.eyebrow")}</span>
        <h1>${t("todo.title")}</h1>
        <p>${t("todo.subtitle")}</p>
      </div>
      <div class="todo-count" aria-live="polite"><strong id="active-count">0</strong><span>${t("todo.remainingUnit")}</span></div>
    </header>

    <section class="composer" aria-labelledby="composer-title">
      <h2 id="composer-title">${t("todo.createTitle")}</h2>
      <div class="composer-row">
        <label class="sr-only" for="todo-title">${t("todo.placeholder")}</label>
        <input id="todo-title" class="todo-input" placeholder="${t("todo.placeholder")}" autocomplete="off" />
        <button id="add-todo" class="add-todo" type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          <span>${t("todo.add")}</span>
        </button>
      </div>
      <p class="input-error" id="title-error" role="alert" hidden>${t("todo.titleRequired")}</p>
      <div class="composer-options">
        <div>
          <label class="field-label" for="todo-reminder">${t("todo.remindAt")}</label>
          <input id="todo-reminder" class="todo-input compact" type="datetime-local" />
        </div>
        <fieldset class="priority-picker">
          <legend class="field-label">${t("todo.priority")}</legend>
          <label><input type="radio" name="priority" value="normal" checked /><span>${t("todo.priorityNormal")}</span></label>
          <label class="important"><input type="radio" name="priority" value="important" /><span>${t("todo.priorityImportant")}</span></label>
          <label class="urgent"><input type="radio" name="priority" value="urgent" /><span>${t("todo.priorityUrgent")}</span></label>
        </fieldset>
      </div>
    </section>

    <nav class="todo-filters" aria-label="${t("todo.filtersLabel")}">
      <button class="active" type="button" data-filter="all">${t("todo.filterAll")}</button>
      <button type="button" data-filter="active">${t("todo.filterActive")}</button>
      <button type="button" data-filter="done">${t("todo.filterDone")}</button>
    </nav>
    <section class="todo-list" id="todo-list" aria-live="polite"></section>
    </div>
  </main>
`;

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const persist = () => {
  saveTodos(todos);
  void emitTo("main", todoEventName, todos);
};

const render = () => {
  const visibleTodos = todos.filter((todo) => activeFilter === "all" || (activeFilter === "done" ? todo.done : !todo.done));
  byId<HTMLElement>("active-count").textContent = String(todos.filter((todo) => !todo.done).length);
  byId<HTMLElement>("todo-list").innerHTML = visibleTodos.length
    ? visibleTodos.map((todo) => `
      <article class="todo-card priority-${todo.priority} ${todo.done ? "done" : ""}">
        <label class="todo-check">
          <input type="checkbox" data-toggle="${todo.id}" ${todo.done ? "checked" : ""} />
          <span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9" /></svg></span>
        </label>
        <div class="todo-content">
          <h2>${escapeHtml(todo.title)}</h2>
          <div class="todo-meta">
            <span class="priority-badge">${t(`todo.priority${todo.priority[0].toUpperCase()}${todo.priority.slice(1)}`)}</span>
            <time>${escapeHtml(formatReminder(todo.remindAt))}</time>
          </div>
        </div>
        <button class="delete-todo" type="button" data-delete="${todo.id}" aria-label="${t("todo.delete")}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5M14 11v5" /></svg>
        </button>
      </article>
    `).join("")
    : `<div class="todo-empty"><span aria-hidden="true">✓</span><h2>${t("todo.empty")}</h2><p>${t("todo.emptyHint")}</p></div>`;
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
  const priority = (document.querySelector<HTMLInputElement>('input[name="priority"]:checked')?.value ?? "normal") as TodoPriority;
  todos.unshift(normalizeTodo({
    id: crypto.randomUUID(),
    title,
    remindAt: byId<HTMLInputElement>("todo-reminder").value,
    priority,
  }));
  titleInput.value = "";
  persist();
  render();
  titleInput.focus();
};

byId("add-todo").addEventListener("click", addTodo);
byId("close-todo").addEventListener("click", () => void todoWindow.hide());
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
render();
