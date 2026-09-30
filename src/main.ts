import "./styles.css";

import { getCurrentWindow, LogicalSize, PhysicalPosition } from "@tauri-apps/api/window";
import { getLocale, localeOptions, setLocale, t, type Locale } from "./i18n";
import {
  disable as disableAutostart,
  enable as enableAutostart,
} from "@tauri-apps/plugin-autostart";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

type ReminderMode = "interval" | "fixed";

type Pet = {
  id: string;
  name: string;
  emoji: string;
  nameKey: string;
  noteKey: string;
  accent: string;
};

type Todo = {
  id: string;
  title: string;
  done: boolean;
};

type AppState = {
  petId: string;
  scale: number;
  alwaysOnTop: boolean;
  autostart: boolean;
  reduceMotion: boolean;
  reminderMode: ReminderMode;
  reminderValue: string;
  dailyTarget: number;
  waterDone: number;
  waterDate: string;
  todos: Todo[];
  position?: { x: number; y: number };
};

const pets: Pet[] = [
  { id: "alaskan", name: "alaskan", nameKey: "pets.alaskan.name", emoji: "🐺", noteKey: "pets.alaskan.note", accent: "#9c7b63" },
  { id: "shepherd", name: "shepherd", nameKey: "pets.shepherd.name", emoji: "🐕", noteKey: "pets.shepherd.note", accent: "#9a6b42" },
  { id: "siamese", name: "siamese", nameKey: "pets.siamese.name", emoji: "🐈", noteKey: "pets.siamese.note", accent: "#ad8066" },
  { id: "maine-coon", name: "maine-coon", nameKey: "pets.maineCoon.name", emoji: "🐈‍⬛", noteKey: "pets.maineCoon.note", accent: "#635d6e" },
];

const stateKey = "desktop-pet-state-v1";
const appWindow = getCurrentWindow();
let reminderTimer: number | undefined;
let lastReminderStamp = "";

const today = () => new Date().toISOString().slice(0, 10);

const defaultState = (): AppState => ({
  petId: pets[0].id,
  scale: 1,
  alwaysOnTop: true,
  autostart: false,
  reduceMotion: false,
  reminderMode: "interval",
  reminderValue: "60",
  dailyTarget: 1600,
  waterDone: 0,
  waterDate: today(),
  todos: [],
});

const loadState = (): AppState => {
  try {
    const stored = JSON.parse(localStorage.getItem(stateKey) ?? "null") as Partial<AppState> | null;
    const next = { ...defaultState(), ...stored };
    if (next.waterDate !== today()) {
      next.waterDate = today();
      next.waterDone = 0;
    }
    return next;
  } catch {
    return defaultState();
  }
};

let state = loadState();

const saveState = () => localStorage.setItem(stateKey, JSON.stringify(state));
const selectedPet = () => pets.find((pet) => pet.id === state.petId) ?? pets[0];
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const petLabel = (pet: Pet) => t(pet.nameKey);
const petNote = (pet: Pet) => t(pet.noteKey);

document.body.innerHTML = `
  <main class="app-shell">
    <section class="pet-stage" id="pet-stage">
      <div class="topbar">
        <span class="status-dot"></span>
        <span id="status-label">${t("status.companion")}</span>
        <button class="icon-button" id="settings-button" aria-label="${t("accessibility.openSettings")}">⚙</button>
      </div>
      <div class="pet-surface" id="pet-surface" tabindex="0" role="button" aria-label="${t("accessibility.interactWithPet")} ">
        <div class="pet-shadow"></div>
        <div class="pet-aura"></div>
        <div class="pet-emoji" id="pet-emoji"></div>
        <div class="pet-spark spark-one">✦</div>
        <div class="pet-spark spark-two">·</div>
      </div>
      <div class="pet-caption">
        <strong id="pet-name"></strong>
        <span id="pet-note"></span>
      </div>
      <div class="speech-bubble" id="speech-bubble">${t("messages.defaultBubble")}</div>
      <div class="quick-actions">
        <button class="action-button primary" id="drink-button">${t("actions.drink")}</button>
        <button class="action-button" id="feed-button">${t("actions.feed")}</button>
        <button class="action-button" id="todo-button">${t("actions.todo")}</button>
      </div>
      <div class="progress-card">
        <div class="progress-heading"><span>${t("hydration.title")}</span><strong id="water-label"></strong></div>
        <div class="progress-track"><div class="progress-value" id="water-progress"></div></div>
        <div class="progress-foot"><span id="water-remaining"></span><span>${t("hydration.targetHint")}</span></div>
      </div>
    </section>
    <aside class="settings-panel hidden" id="settings-panel">
      <div class="panel-heading"><div><span class="eyebrow">DESKTOP PET</span><h1>${t("settings.title")}</h1></div><button class="icon-button" id="close-settings">×</button></div>
      <label class="field-label" for="pet-select">${t("settings.petAppearance")}</label>
      <select class="field" id="pet-select"></select>
      <label class="field-label" for="scale-input">${t("settings.petSize")} <span id="scale-label"></span></label>
      <input class="range" id="scale-input" type="range" min="0.6" max="2.2" step="0.1" />
      <div class="setting-row"><span>${t("settings.alwaysOnTop")}</span><input id="always-top-input" type="checkbox" /></div>
      <div class="setting-row"><span>${t("settings.autostart")} <small>${t("settings.autostartHint")}</small></span><input id="autostart-input" type="checkbox" /></div>
      <div class="setting-row"><span>${t("settings.reduceMotion")}</span><input id="reduce-motion-input" type="checkbox" /></div>
      <label class="field-label" for="language-input">${t("settings.language")}</label>
      <select class="field" id="language-input">${localeOptions.map(({ value, labelKey }) => `<option value="${value}">${t(labelKey)}</option>`).join("")}</select>
      <div class="section-divider"></div>
      <label class="field-label" for="target-input">${t("hydration.dailyTarget")}</label>
      <input class="field" id="target-input" type="number" min="200" max="5000" step="50" />
      <label class="field-label" for="reminder-mode-input">${t("reminders.mode")}</label>
      <select class="field" id="reminder-mode-input"><option value="interval">${t("reminders.intervalOption")}</option><option value="fixed">${t("reminders.fixedOption")}</option></select>
      <label class="field-label" for="reminder-value-input" id="reminder-value-label">${t("reminders.intervalLabel")}</label>
      <input class="field" id="reminder-value-input" type="text" inputmode="numeric" />
      <div class="panel-tip">${t("settings.reminderTip")}</div>
      <div class="section-divider"></div>
      <div class="panel-heading compact"><div><span class="eyebrow">TODO</span><h2>${t("todo.title")}</h2></div></div>
      <div class="todo-create"><input class="field" id="todo-input" placeholder="${t("todo.placeholder")}" /><button class="add-button" id="add-todo" aria-label="${t("todo.add")}">+</button></div>
      <div class="todo-list" id="todo-list"></div>
    </aside>
  </main>
`;

const petStage = byId<HTMLElement>("pet-stage");
const petSurface = byId<HTMLElement>("pet-surface");
const settingsPanel = byId<HTMLElement>("settings-panel");
const speechBubble = byId<HTMLElement>("speech-bubble");

const showMessage = (message: string) => {
  speechBubble.textContent = message;
  speechBubble.classList.remove("visible");
  requestAnimationFrame(() => speechBubble.classList.add("visible"));
};

const render = () => {
  const pet = selectedPet();
  const progress = Math.min(100, (state.waterDone / state.dailyTarget) * 100);
  byId<HTMLElement>("pet-emoji").textContent = pet.emoji;
  byId<HTMLElement>("pet-name").textContent = petLabel(pet);
  byId<HTMLElement>("pet-note").textContent = petNote(pet);
  byId<HTMLElement>("water-label").textContent = `${state.waterDone} / ${state.dailyTarget} ml`;
  byId<HTMLElement>("water-remaining").textContent = state.waterDone >= state.dailyTarget ? t("hydration.goalDone") : t("hydration.remaining", { amount: state.dailyTarget - state.waterDone });
  byId<HTMLElement>("water-progress").style.width = `${progress}%`;
  byId<HTMLSelectElement>("pet-select").value = state.petId;
  byId<HTMLInputElement>("scale-input").value = String(state.scale);
  byId<HTMLElement>("scale-label").textContent = `${Math.round(state.scale * 100)}%`;
  byId<HTMLInputElement>("always-top-input").checked = state.alwaysOnTop;
  byId<HTMLInputElement>("autostart-input").checked = state.autostart;
  byId<HTMLInputElement>("reduce-motion-input").checked = state.reduceMotion;
  byId<HTMLInputElement>("target-input").value = String(state.dailyTarget);
  byId<HTMLSelectElement>("reminder-mode-input").value = state.reminderMode;
  byId<HTMLInputElement>("reminder-value-input").value = state.reminderValue;
  byId<HTMLElement>("reminder-value-label").textContent = state.reminderMode === "interval" ? t("reminders.intervalLabel") : t("reminders.fixedLabel");
  byId<HTMLSelectElement>("language-input").value = getLocale();
  document.documentElement.dataset.reduceMotion = state.reduceMotion ? "true" : "false";
  document.documentElement.style.setProperty("--pet-accent", pet.accent);
  renderTodos();
};

const renderTodos = () => {
  const list = byId<HTMLElement>("todo-list");
  list.innerHTML = state.todos.length
    ? state.todos.map((todo) => `<label class="todo-item ${todo.done ? "done" : ""}"><input type="checkbox" data-todo="${todo.id}" ${todo.done ? "checked" : ""}/><span>${escapeHtml(todo.title)}</span></label>`).join("")
    : `<div class="empty-state">${t("todo.empty")}</div>`;
};

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);

const applyWindowSettings = async () => {
  await appWindow.setTitle(t("app.title"));
  await appWindow.setAlwaysOnTop(state.alwaysOnTop);
  await appWindow.setSize(new LogicalSize(360 * state.scale, 420 * state.scale));
  if (state.position) {
    await appWindow.setPosition(new PhysicalPosition(state.position.x, state.position.y));
  }
};

const savePosition = async () => {
  try {
    const position = await appWindow.outerPosition();
    state.position = { x: position.x, y: position.y };
    saveState();
  } catch {
    // Position persistence is best-effort during the initial webview bootstrap.
  }
};

const recordWater = (amount: number) => {
  if (state.waterDate !== today()) {
    state.waterDate = today();
    state.waterDone = 0;
  }
  state.waterDone = Math.min(state.dailyTarget, state.waterDone + amount);
  saveState();
  render();
  showMessage(state.waterDone >= state.dailyTarget ? t("messages.hydrationGoalDone") : t("messages.hydrationRecorded"));
  petStage.classList.remove("celebrate");
  requestAnimationFrame(() => petStage.classList.add("celebrate"));
};

const notify = async (title: string, body: string) => {
  try {
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    if (granted) sendNotification({ title, body });
  } catch {
    showMessage(t("messages.notificationUnavailable"));
  }
};

const reminderStamp = () => `${today()}-${new Date().getHours()}:${new Date().getMinutes()}`;

const checkReminder = () => {
  const now = new Date();
  const stamp = reminderStamp();
  let due = false;
  if (state.reminderMode === "fixed") {
    const [hours, minutes] = state.reminderValue.split(":").map(Number);
    due = hours === now.getHours() && minutes === now.getMinutes();
  } else {
    const interval = Number(state.reminderValue);
    due = Number.isFinite(interval) && interval > 0 && now.getMinutes() % interval === 0;
  }
  if (due && lastReminderStamp !== stamp && state.waterDone < state.dailyTarget) {
    lastReminderStamp = stamp;
    showMessage(t("messages.reminder"));
    void notify(t("actions.drink"), t("messages.notificationBody", { done: state.waterDone, target: state.dailyTarget }));
  }
};

const updateAutostart = async (enabled: boolean) => {
  try {
    if (enabled) await enableAutostart();
    else await disableAutostart();
    state.autostart = enabled;
    saveState();
  } catch {
    state.autostart = false;
    byId<HTMLInputElement>("autostart-input").checked = false;
    showMessage(t("messages.autostartUnavailable"));
  }
};

const addTodo = () => {
  const input = byId<HTMLInputElement>("todo-input");
  const title = input.value.trim();
  if (!title) return;
  state.todos.unshift({ id: crypto.randomUUID(), title, done: false });
  input.value = "";
  saveState();
  renderTodos();
  showMessage(t("messages.todoAdded"));
};

byId<HTMLSelectElement>("pet-select").innerHTML = pets.map((pet) => `<option value="${pet.id}">${pet.emoji} ${petLabel(pet)}</option>`).join("");
byId("settings-button").addEventListener("click", () => settingsPanel.classList.remove("hidden"));
byId("close-settings").addEventListener("click", () => settingsPanel.classList.add("hidden"));
byId("drink-button").addEventListener("click", () => recordWater(250));
byId("feed-button").addEventListener("click", () => showMessage(t("messages.feed")));
byId("todo-button").addEventListener("click", () => settingsPanel.classList.remove("hidden"));
petSurface.addEventListener("click", () => showMessage(t("messages.petInteraction")));
petSurface.addEventListener("pointerdown", async (event) => {
  if (event.button === 0) await appWindow.startDragging();
});
window.addEventListener("pointerup", () => void savePosition());

byId<HTMLSelectElement>("pet-select").addEventListener("change", (event) => {
  state.petId = (event.target as HTMLSelectElement).value;
  saveState();
  render();
  showMessage(t("messages.petChanged", { pet: petLabel(selectedPet()) }));
});
byId<HTMLInputElement>("scale-input").addEventListener("input", async (event) => {
  state.scale = Number((event.target as HTMLInputElement).value);
  saveState();
  render();
  await appWindow.setSize(new LogicalSize(360 * state.scale, 420 * state.scale));
});
byId<HTMLInputElement>("always-top-input").addEventListener("change", async (event) => {
  state.alwaysOnTop = (event.target as HTMLInputElement).checked;
  saveState();
  await appWindow.setAlwaysOnTop(state.alwaysOnTop);
});
byId<HTMLInputElement>("autostart-input").addEventListener("change", (event) => void updateAutostart((event.target as HTMLInputElement).checked));
byId<HTMLInputElement>("reduce-motion-input").addEventListener("change", (event) => {
  state.reduceMotion = (event.target as HTMLInputElement).checked;
  saveState();
  render();
});
byId<HTMLSelectElement>("language-input").addEventListener("change", (event) => {
  setLocale((event.target as HTMLSelectElement).value as Locale);
  window.location.reload();
});
byId<HTMLInputElement>("target-input").addEventListener("change", (event) => {
  state.dailyTarget = Math.max(200, Math.min(5000, Number((event.target as HTMLInputElement).value) || 1600));
  state.waterDone = Math.min(state.waterDone, state.dailyTarget);
  saveState();
  render();
});
byId<HTMLSelectElement>("reminder-mode-input").addEventListener("change", (event) => {
  state.reminderMode = (event.target as HTMLSelectElement).value as ReminderMode;
  state.reminderValue = state.reminderMode === "interval" ? "60" : "10:00";
  saveState();
  render();
});
byId<HTMLInputElement>("reminder-value-input").addEventListener("change", (event) => {
  state.reminderValue = (event.target as HTMLInputElement).value.trim();
  saveState();
});
byId("add-todo").addEventListener("click", addTodo);
byId<HTMLInputElement>("todo-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter") addTodo();
});
byId("todo-list").addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement;
  const id = target.dataset.todo;
  const todo = state.todos.find((item) => item.id === id);
  if (todo) todo.done = target.checked;
  saveState();
  renderTodos();
});

render();
void applyWindowSettings();
reminderTimer = window.setInterval(checkReminder, 30_000);
window.addEventListener("beforeunload", () => {
  if (reminderTimer) window.clearInterval(reminderTimer);
  void savePosition();
});
