import "./styles.css";

import { getCurrentWindow, LogicalSize, PhysicalPosition } from "@tauri-apps/api/window";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
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
  note: string;
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
  { id: "alaskan", name: "阿拉斯加", emoji: "🐺", note: "蓬松、可靠、喜欢陪你工作", accent: "#9c7b63" },
  { id: "shepherd", name: "德国牧羊犬", emoji: "🐕", note: "警觉、聪明、负责提醒你休息", accent: "#9a6b42" },
  { id: "siamese", name: "暹罗猫", emoji: "🐈", note: "优雅、黏人、偶尔傲娇", accent: "#ad8066" },
  { id: "maine-coon", name: "缅因猫", emoji: "🐈‍⬛", note: "温柔、安静、体型大但桌宠很轻", accent: "#635d6e" },
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

document.body.innerHTML = `
  <main class="app-shell">
    <section class="pet-stage" id="pet-stage">
      <div class="topbar">
        <span class="status-dot"></span>
        <span id="status-label">陪伴中</span>
        <button class="icon-button" id="settings-button" aria-label="打开设置">⚙</button>
      </div>
      <div class="pet-surface" id="pet-surface" tabindex="0" role="button" aria-label="和桌宠互动">
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
      <div class="speech-bubble" id="speech-bubble">今天也要记得喝水呀。</div>
      <div class="quick-actions">
        <button class="action-button primary" id="drink-button">喝水 +250ml</button>
        <button class="action-button" id="feed-button">喂食</button>
        <button class="action-button" id="todo-button">Todo</button>
      </div>
      <div class="progress-card">
        <div class="progress-heading"><span>今日饮水</span><strong id="water-label"></strong></div>
        <div class="progress-track"><div class="progress-value" id="water-progress"></div></div>
        <div class="progress-foot"><span id="water-remaining"></span><span>目标可在设置中调整</span></div>
      </div>
    </section>
    <aside class="settings-panel hidden" id="settings-panel">
      <div class="panel-heading"><div><span class="eyebrow">DESKTOP PET</span><h1>设置</h1></div><button class="icon-button" id="close-settings">×</button></div>
      <label class="field-label" for="pet-select">桌宠形象</label>
      <select class="field" id="pet-select"></select>
      <label class="field-label" for="scale-input">桌宠尺寸 <span id="scale-label"></span></label>
      <input class="range" id="scale-input" type="range" min="0.6" max="2.2" step="0.1" />
      <div class="setting-row"><span>始终置顶</span><input id="always-top-input" type="checkbox" /></div>
      <div class="setting-row"><span>开机自启 <small>默认关闭</small></span><input id="autostart-input" type="checkbox" /></div>
      <div class="setting-row"><span>减少动画</span><input id="reduce-motion-input" type="checkbox" /></div>
      <div class="section-divider"></div>
      <label class="field-label" for="target-input">每日饮水目标（ml）</label>
      <input class="field" id="target-input" type="number" min="200" max="5000" step="50" />
      <label class="field-label" for="reminder-mode-input">提醒方式</label>
      <select class="field" id="reminder-mode-input"><option value="interval">按间隔提醒</option><option value="fixed">固定时间提醒</option></select>
      <label class="field-label" for="reminder-value-input" id="reminder-value-label">间隔分钟</label>
      <input class="field" id="reminder-value-input" type="text" inputmode="numeric" />
      <div class="panel-tip">提醒会在桌宠隐藏时继续运行；退出应用后停止。</div>
      <div class="section-divider"></div>
      <div class="panel-heading compact"><div><span class="eyebrow">TODO</span><h2>今日待办</h2></div></div>
      <div class="todo-create"><input class="field" id="todo-input" placeholder="写下一件小事" /><button class="add-button" id="add-todo">+</button></div>
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
  byId<HTMLElement>("pet-name").textContent = pet.name;
  byId<HTMLElement>("pet-note").textContent = pet.note;
  byId<HTMLElement>("water-label").textContent = `${state.waterDone} / ${state.dailyTarget} ml`;
  byId<HTMLElement>("water-remaining").textContent = state.waterDone >= state.dailyTarget ? "今日目标完成" : `还差 ${state.dailyTarget - state.waterDone} ml`;
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
  byId<HTMLElement>("reminder-value-label").textContent = state.reminderMode === "interval" ? "间隔分钟" : "固定时间（HH:MM）";
  document.documentElement.dataset.reduceMotion = state.reduceMotion ? "true" : "false";
  document.documentElement.style.setProperty("--pet-accent", pet.accent);
  renderTodos();
};

const renderTodos = () => {
  const list = byId<HTMLElement>("todo-list");
  list.innerHTML = state.todos.length
    ? state.todos.map((todo) => `<label class="todo-item ${todo.done ? "done" : ""}"><input type="checkbox" data-todo="${todo.id}" ${todo.done ? "checked" : ""}/><span>${escapeHtml(todo.title)}</span></label>`).join("")
    : '<div class="empty-state">今天还没有 Todo</div>';
};

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);

const applyWindowSettings = async () => {
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
  showMessage(state.waterDone >= state.dailyTarget ? "今天的饮水目标完成啦！" : "很好，喝水完成，继续保持。 ");
  petStage.classList.remove("celebrate");
  requestAnimationFrame(() => petStage.classList.add("celebrate"));
};

const notify = async (title: string, body: string) => {
  try {
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    if (granted) sendNotification({ title, body });
  } catch {
    showMessage("系统通知暂不可用，我会继续在桌宠里提醒你。");
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
    showMessage("该喝水啦，完成后点一下喝水按钮。");
    void notify("喝水提醒", `今天已完成 ${state.waterDone} / ${state.dailyTarget} ml`);
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
    showMessage("开机自启需要安装后的应用环境，当前先保留设置。");
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
  showMessage("已记下这件小事。 ");
};

byId<HTMLSelectElement>("pet-select").innerHTML = pets.map((pet) => `<option value="${pet.id}">${pet.emoji} ${pet.name}</option>`).join("");
byId("settings-button").addEventListener("click", () => settingsPanel.classList.remove("hidden"));
byId("close-settings").addEventListener("click", () => settingsPanel.classList.add("hidden"));
byId("drink-button").addEventListener("click", () => recordWater(250));
byId("feed-button").addEventListener("click", () => showMessage("谢谢投喂！我会乖乖陪着你。"));
byId("todo-button").addEventListener("click", () => settingsPanel.classList.remove("hidden"));
petSurface.addEventListener("click", () => showMessage("摸摸我！今天也一起专注一下。"));
petSurface.addEventListener("pointerdown", async (event) => {
  if (event.button === 0) await appWindow.startDragging();
});
window.addEventListener("pointerup", () => void savePosition());

byId<HTMLSelectElement>("pet-select").addEventListener("change", (event) => {
  state.petId = (event.target as HTMLSelectElement).value;
  saveState();
  render();
  showMessage(`换成${selectedPet().name}啦。`);
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
