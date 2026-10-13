import "./styles.css";

import {
  availableMonitors,
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
  primaryMonitor,
} from "@tauri-apps/api/window";
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
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getLocale, localeOptions, setLocale, t, type Locale } from "./i18n";
import type { PetAction, PetAnimationAsset, PetSkinManifest } from "./pet-skin";
import { SpritePlayer } from "./sprite-player";
import { normalizeTodo, todoEventName, type Todo } from "./todo-store";

type ReminderMode = "interval" | "fixed";
type TargetMode = "guideline" | "custom";
type GuidelineProfile = "female" | "male";

type Pet = {
  id: string;
  nameKey: string;
  noteKey: string;
  accent: string;
  portrait: string;
  skin: PetSkinManifest;
};

type AppState = {
  version: 3;
  petId: string;
  petSize: number;
  alwaysOnTop: boolean;
  autostart: boolean;
  reduceMotion: boolean;
  targetMode: TargetMode;
  guidelineProfile: GuidelineProfile;
  customTarget: number;
  waterDone: number;
  waterDate: string;
  reminderMode: ReminderMode;
  reminderValue: string;
  lastHydrationReminderAt: number;
  lastHydrationReminderKey: string;
  todos: Todo[];
  position?: { x: number; y: number };
};

const portrait = (id: string) => new URL(`./assets/pets/${id}/portrait.png`, import.meta.url).href;
const animation = (id: string, action: string) => new URL(`./assets/pets/${id}/animations/${action}.png`, import.meta.url).href;
const skin = (id: string, animations: PetSkinManifest["animations"] = {}): PetSkinManifest => ({
  schemaVersion: 1,
  id: `${id}-default`,
  name: id,
  canvas: { width: 512, height: 512 },
  anchor: { x: 0.5, y: 0.96 },
  preview: portrait(id),
  animations,
});

const animationAsset = (id: string, action: string, fps: number, loop: boolean): PetAnimationAsset => ({
  src: animation(id, action),
  frames: 16,
  columns: 4,
  rows: 4,
  fps,
  loop,
  frameMap: id === "alaskan" && action === "touch"
    ? [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 0]
    : id === "shepherd" && action === "feed"
      ? [0, 1, 2, 3, 4, 5, 5, 5, 5, 5, 6, 7, 8, 12, 13, 14]
      : undefined,
  edgeCleanup: id === "maine-coon" ? "green-fringe" : undefined,
});
const animatedSkin = (id: string) => skin(id, {
  idle: animationAsset(id, "idle", 10, true),
  touch: animationAsset(id, "touch", 16, false),
  drink: animationAsset(id, "drink", 16, false),
  feed: animationAsset(id, "feed", 16, false),
  run: animationAsset(id, "run", 20, true),
});

const pets: Pet[] = [
  { id: "alaskan", nameKey: "pets.alaskan.name", noteKey: "pets.alaskan.note", accent: "#8a756a", portrait: portrait("alaskan"), skin: animatedSkin("alaskan") },
  { id: "shepherd", nameKey: "pets.shepherd.name", noteKey: "pets.shepherd.note", accent: "#a76b32", portrait: portrait("shepherd"), skin: animatedSkin("shepherd") },
  { id: "siamese", nameKey: "pets.siamese.name", noteKey: "pets.siamese.note", accent: "#6e8fb8", portrait: portrait("siamese"), skin: animatedSkin("siamese") },
  { id: "maine-coon", nameKey: "pets.maineCoon.name", noteKey: "pets.maineCoon.note", accent: "#8c6d4f", portrait: portrait("maine-coon"), skin: animatedSkin("maine-coon") },
];

const stateKey = "desktop-pet-state-v3";
const legacyStateKey = "desktop-pet-state-v2";
const oldestStateKey = "desktop-pet-state-v1";
const appWindow = getCurrentWindow();
let reminderTimer: number | undefined;
let actionTimer: number | undefined;
let messageTimer: number | undefined;
let stopTodoSync: (() => void) | undefined;
let panelOpen = false;
let currentAction: PetAction = "idle";
let petFacing: "left" | "right" = "right";

const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const defaultState = (): AppState => ({
  version: 3,
  petId: pets[0].id,
  petSize: 100,
  alwaysOnTop: true,
  autostart: false,
  reduceMotion: false,
  targetMode: "guideline",
  guidelineProfile: "female",
  customTarget: 1600,
  waterDone: 0,
  waterDate: localDateKey(),
  reminderMode: "interval",
  reminderValue: "60",
  lastHydrationReminderAt: Date.now(),
  lastHydrationReminderKey: "",
  todos: [],
});

const loadState = (): AppState => {
  try {
    const current = JSON.parse(localStorage.getItem(stateKey) ?? "null") as Partial<AppState> | null;
    const legacy = JSON.parse(localStorage.getItem(legacyStateKey) ?? "null") as Partial<AppState> | null;
    const oldest = JSON.parse(localStorage.getItem(oldestStateKey) ?? "null") as ({ scale?: number; dailyTarget?: number; todos?: Partial<Todo>[] } & Partial<AppState>) | null;
    const stored = current ?? legacy ?? oldest;
    if (!stored) return defaultState();
    const storedPetSize = "petSize" in stored ? Number(stored.petSize) : Math.round(72 * Number(oldest?.scale ?? 1));
    const migratedPetSize = !current && legacy && storedPetSize === 72 ? 100 : storedPetSize;
    const next: AppState = {
      ...defaultState(),
      ...stored,
      version: 3,
      petSize: migratedPetSize,
      customTarget: "customTarget" in stored ? Number(stored.customTarget) : Number(oldest?.dailyTarget ?? 1600),
      todos: (stored.todos ?? []).map(normalizeTodo),
    };
    next.petSize = Math.max(48, Math.min(220, next.petSize || 100));
    if (next.waterDate !== localDateKey()) {
      next.waterDate = localDateKey();
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
const targetAmount = () => state.targetMode === "custom"
  ? Math.max(200, Math.min(5000, state.customTarget))
  : state.guidelineProfile === "male" ? 1700 : 1500;
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
document.body.innerHTML = `
  <main class="app-shell" id="app-shell">
    <section class="pet-stage" id="pet-stage" data-action="idle">
      <div class="speech-bubble" id="speech-bubble" role="status">${t("messages.defaultBubble")}</div>
      <button class="settings-trigger" id="settings-button" aria-label="${t("accessibility.openSettings")}" data-tooltip="${t("actions.settings")}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.75a2 2 0 0 1 1.93 1.48l.18.67a6.9 6.9 0 0 1 1.26.73l.67-.18a2 2 0 0 1 2.22.94l.5.87a2 2 0 0 1-.3 2.39l-.5.49c.03.29.05.58.05.87 0 .3-.02.59-.05.87l.5.5a2 2 0 0 1 .3 2.38l-.5.87a2 2 0 0 1-2.22.94l-.67-.18c-.4.28-.82.52-1.26.73l-.18.67A2 2 0 0 1 12 20.25h-1a2 2 0 0 1-1.93-1.48l-.18-.67a6.9 6.9 0 0 1-1.26-.73l-.67.18a2 2 0 0 1-2.22-.94l-.5-.87a2 2 0 0 1 .3-2.39l.5-.49A7.7 7.7 0 0 1 5 12c0-.3.02-.59.05-.87l-.5-.5a2 2 0 0 1-.3-2.38l.5-.87a2 2 0 0 1 2.22-.94l.67.18c.4-.28.82-.52 1.26-.73l.18-.67A2 2 0 0 1 11 3.75h1Z"/><circle cx="11.5" cy="12" r="2.4"/></svg>
      </button>
      <div class="pet-surface" id="pet-surface" tabindex="0" role="button" aria-label="${t("accessibility.interactWithPet")}">
        <div class="pet-shadow"></div>
        <div class="pet-aura"></div>
        <img class="pet-image" id="pet-image" alt="" draggable="false" />
        <canvas class="pet-sprite" id="pet-sprite" aria-hidden="true" hidden></canvas>
        <span class="action-prop" id="action-prop" aria-hidden="true"></span>
      </div>
      <div class="quick-actions" id="quick-actions" aria-label="${t("accessibility.quickActions")}">
        <button class="quick-button" id="drink-button" aria-label="${t("actions.drink")}" data-tooltip="${t("actions.drink")}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.4s5 5.7 5 10a5 5 0 1 1-10 0c0-4.3 5-10 5-10Z"/><path d="M9.5 14.1c.25 1.3 1.08 2.05 2.5 2.25"/></svg></button>
        <button class="quick-button" id="feed-button" aria-label="${t("actions.feed")}" data-tooltip="${t("actions.feed")}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.1 5.5a3 3 0 0 0-4.2 4.2l.7.7-.7.7a3 3 0 0 0 4.2 4.2l.8-.7 5.4 5.4a3 3 0 0 0 4.2-4.2l-.7-.7.7-.8a3 3 0 0 0-4.2-4.2l-5.4-5.4-.8.8Z"/></svg></button>
        <button class="quick-button" id="todo-button" aria-label="${t("actions.todo")}" data-tooltip="${t("actions.todo")}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 6.5h9M8.5 12h9M8.5 17.5h9"/><path d="m4 6.4.9.9 1.7-1.8M4 11.9l.9.9 1.7-1.8M4 17.4l.9.9 1.7-1.8"/></svg></button>
      </div>
      <div class="pet-context-menu" id="pet-context-menu" role="menu" aria-label="${t("accessibility.petContextMenu")}" hidden>
        <button id="context-settings-button" role="menuitem"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.37a1.7 1.7 0 0 0-1 .63 1.7 1.7 0 0 0-.37 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.23 15a1.7 1.7 0 0 0-.63-1 1.7 1.7 0 0 0-1.1-.37H2.4v-4h.09A1.7 1.7 0 0 0 4 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.4 4.23a1.7 1.7 0 0 0 1-.63 1.7 1.7 0 0 0 .37-1.1V2.4h4v.09A1.7 1.7 0 0 0 15 4a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 8.4c.3.28.52.62.63 1 .1.34.13.71.09 1.1h.01v3.2H20a1.7 1.7 0 0 0-.6 1.3Z"/></svg><span>${t("actions.settings")}</span></button>
        <div class="context-divider" aria-hidden="true"></div>
        <button class="danger-item" id="quit-button" role="menuitem" aria-label="${t("accessibility.quitApp")}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v9M6.2 6.2a8 8 0 1 0 11.6 0"/></svg><span>${t("actions.quit")}</span></button>
      </div>
    </section>
    <aside class="settings-panel" id="settings-panel" aria-hidden="true">
      <header class="panel-heading">
        <div class="panel-identity">
          <div class="panel-pet-preview"><img id="panel-pet-image" alt="" /></div>
          <div><span class="eyebrow">${t("settings.companionLabel")}</span><h1>${t("settings.title")}</h1><p id="panel-pet-note">${t("settings.subtitle")}</p></div>
        </div>
        <button class="icon-button" id="close-settings" aria-label="${t("accessibility.closeSettings")}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button>
      </header>
      <div class="panel-scroll">
        <section class="hydration-card">
          <div class="section-heading"><div><span class="eyebrow">${t("hydration.eyebrow")}</span><h2>${t("hydration.title")}</h2></div><strong class="metric" id="water-label"></strong></div>
          <div class="progress-track"><div class="progress-value" id="water-progress"></div></div>
          <div class="progress-foot"><span id="water-remaining"></span><button class="primary-button" id="panel-drink-button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.4s5 5.7 5 10a5 5 0 1 1-10 0c0-4.3 5-10 5-10Z"/></svg>${t("actions.drink")}</button></div>
          <div class="form-grid hydration-options">
            <div><label class="field-label" for="target-mode-input">${t("hydration.targetMode")}</label><select class="field" id="target-mode-input"><option value="guideline">${t("hydration.guidelineMode")}</option><option value="custom">${t("hydration.customMode")}</option></select></div>
            <div id="guideline-fields"><label class="field-label" for="guideline-profile-input">${t("hydration.guidelineProfile")}</label><select class="field" id="guideline-profile-input"><option value="female">${t("hydration.adultFemale")}</option><option value="male">${t("hydration.adultMale")}</option></select></div>
            <div id="custom-target-fields"><label class="field-label" for="target-input">${t("hydration.dailyTarget")}</label><input class="field" id="target-input" type="number" min="200" max="5000" step="50" /></div>
            <div><label class="field-label" for="reminder-mode-input">${t("reminders.mode")}</label><select class="field" id="reminder-mode-input"><option value="interval">${t("reminders.intervalOption")}</option><option value="fixed">${t("reminders.fixedOption")}</option></select></div>
            <div><label class="field-label" for="reminder-value-input" id="reminder-value-label"></label><input class="field" id="reminder-value-input" /></div>
          </div>
          <p class="panel-tip">${t("hydration.guidelineHint")}</p>
        </section>

        <section class="panel-section">
          <div class="section-heading"><div><span class="section-kicker">01</span><h2>${t("settings.appearanceTitle")}</h2><p>${t("settings.appearanceHint")}</p></div></div>
          <div class="form-grid">
            <div><label class="field-label" for="pet-select">${t("settings.petAppearance")}</label><select class="field" id="pet-select"></select></div>
            <div><label class="field-label" for="language-input">${t("settings.language")}</label><select class="field" id="language-input">${localeOptions.map(({ value, labelKey }) => `<option value="${value}">${t(labelKey)}</option>`).join("")}</select></div>
          </div>
          <label class="field-label range-label" for="size-input"><span>${t("settings.petSize")}</span><span class="value-chip" id="size-label"></span></label>
          <input class="range" id="size-input" type="range" min="48" max="220" step="4" />
          <div class="switch-stack">
            <label class="switch-row"><span>${t("settings.alwaysOnTop")}</span><span class="switch"><input id="always-top-input" type="checkbox" /><span aria-hidden="true"></span></span></label>
            <label class="switch-row"><span>${t("settings.autostart")}<small>${t("settings.autostartHint")}</small></span><span class="switch"><input id="autostart-input" type="checkbox" /><span aria-hidden="true"></span></span></label>
            <label class="switch-row"><span>${t("settings.reduceMotion")}</span><span class="switch"><input id="reduce-motion-input" type="checkbox" /><span aria-hidden="true"></span></span></label>
          </div>
        </section>

      </div>
      <footer class="panel-footer"><span class="status-dot" aria-hidden="true"></span><span>${t("settings.contextHint")}</span></footer>
    </aside>
  </main>
`;

const petStage = byId<HTMLElement>("pet-stage");
const petSurface = byId<HTMLElement>("pet-surface");
const settingsPanel = byId<HTMLElement>("settings-panel");
const speechBubble = byId<HTMLElement>("speech-bubble");
const petImage = byId<HTMLImageElement>("pet-image");
const petSprite = byId<HTMLCanvasElement>("pet-sprite");
const spritePlayer = new SpritePlayer(petSprite);
const preloadPetAnimations = (pet: Pet) => {
  const assets = Object.values(pet.skin.animations).filter((asset): asset is PetAnimationAsset => Boolean(asset));
  void spritePlayer.preload(assets);
};
const petContextMenu = byId<HTMLElement>("pet-context-menu");
let collapsedPositionBeforePanel: { x: number; y: number } | undefined;
const petDragThreshold = 6;
let petPointer: { id: number; x: number; y: number; dragging: boolean } | undefined;

const hidePetContextMenu = () => {
  petContextMenu.hidden = true;
};
const showMessage = (message: string, duration = 3200) => {
  speechBubble.textContent = message;
  speechBubble.classList.add("visible");
  if (messageTimer) window.clearTimeout(messageTimer);
  messageTimer = window.setTimeout(() => speechBubble.classList.remove("visible"), duration);
};

const setPetAction = (action: PetAction, duration = 900) => {
  currentAction = action;
  petStage.dataset.action = action;
  const asset = selectedPet().skin.animations[action] ?? selectedPet().skin.animations.idle;
  if (asset) {
    petImage.hidden = true;
    petSprite.hidden = false;
    petStage.dataset.sprite = "true";
    void spritePlayer.play(asset, {
      reduceMotion: state.reduceMotion,
      size: state.petSize,
      flipX: action === "run" && petFacing === "left",
    });
  } else {
    spritePlayer.stop();
    petImage.hidden = false;
    petSprite.hidden = true;
    petStage.dataset.sprite = "false";
  }
  if (actionTimer) window.clearTimeout(actionTimer);
  if (action !== "idle" && action !== "run") {
    const assetDuration = asset && !asset.loop ? (asset.frames / asset.fps) * 1000 : duration;
    actionTimer = window.setTimeout(() => setPetAction("idle", 0), assetDuration);
  }
};

const collapsedWindowSize = () => new LogicalSize(Math.max(140, state.petSize + 60), Math.max(158, state.petSize + 86));
const expandedWindowSize = () => new LogicalSize(476, 736);

const anchorExpandedWindow = async (position: { x: number; y: number }) => {
  const scale = await appWindow.scaleFactor();
  const collapsed = collapsedWindowSize();
  const expanded = expandedWindowSize();
  return {
    x: Math.round(position.x + ((collapsed.width - expanded.width) * scale) / 2),
    y: Math.round(position.y + (collapsed.height - expanded.height) * scale),
  };
};

const clampPosition = async (position: { x: number; y: number }) => {
  const monitors = await availableMonitors();
  if (!monitors.length) return position;
  const windowSize = await appWindow.outerSize();
  const containing = monitors.find((monitor) => position.x >= monitor.position.x
    && position.y >= monitor.position.y
    && position.x < monitor.position.x + monitor.size.width
    && position.y < monitor.position.y + monitor.size.height);
  const fallback = await primaryMonitor();
  const monitor = containing ?? fallback ?? monitors[0];
  const maxX = monitor.position.x + Math.max(0, monitor.size.width - windowSize.width);
  const maxY = monitor.position.y + Math.max(0, monitor.size.height - windowSize.height);
  return {
    x: Math.max(monitor.position.x, Math.min(maxX, position.x)),
    y: Math.max(monitor.position.y, Math.min(maxY, position.y)),
  };
};

const restorePosition = async () => {
  if (!state.position) return;
  const position = await clampPosition(state.position);
  state.position = position;
  await appWindow.setPosition(new PhysicalPosition(position.x, position.y));
  saveState();
};

const savePosition = async () => {
  try {
    const position = await appWindow.outerPosition();
    state.position = { x: position.x, y: position.y };
    saveState();
  } catch {
    // Window position persistence is best-effort during shutdown.
  }
};

const setPanelOpen = async (open: boolean) => {
  hidePetContextMenu();
  if (open === panelOpen) return;
  if (open) {
    const position = await appWindow.outerPosition();
    collapsedPositionBeforePanel = { x: position.x, y: position.y };
  }
  panelOpen = open;
  document.documentElement.dataset.panelOpen = open ? "true" : "false";
  settingsPanel.setAttribute("aria-hidden", open ? "false" : "true");
  if (open && collapsedPositionBeforePanel) {
    await appWindow.setSize(expandedWindowSize());
    const anchored = await anchorExpandedWindow(collapsedPositionBeforePanel);
    const clamped = await clampPosition(anchored);
    await appWindow.setPosition(new PhysicalPosition(clamped.x, clamped.y));
    return;
  }
  await appWindow.setSize(collapsedWindowSize());
  if (collapsedPositionBeforePanel) {
    await appWindow.setPosition(new PhysicalPosition(collapsedPositionBeforePanel.x, collapsedPositionBeforePanel.y));
    state.position = collapsedPositionBeforePanel;
    collapsedPositionBeforePanel = undefined;
    saveState();
  }
};

const render = () => {
  const pet = selectedPet();
  const target = targetAmount();
  const progress = Math.min(100, target > 0 ? (state.waterDone / target) * 100 : 0);
  petImage.src = pet.portrait;
  petImage.alt = t(pet.nameKey);
  byId<HTMLImageElement>("panel-pet-image").src = pet.portrait;
  byId<HTMLImageElement>("panel-pet-image").alt = t(pet.nameKey);
  byId<HTMLElement>("panel-pet-note").textContent = t(pet.noteKey);
  byId<HTMLSelectElement>("pet-select").value = state.petId;
  byId<HTMLInputElement>("size-input").value = String(state.petSize);
  byId<HTMLElement>("size-label").textContent = `${state.petSize}px`;
  byId<HTMLInputElement>("always-top-input").checked = state.alwaysOnTop;
  byId<HTMLInputElement>("autostart-input").checked = state.autostart;
  byId<HTMLInputElement>("reduce-motion-input").checked = state.reduceMotion;
  byId<HTMLSelectElement>("target-mode-input").value = state.targetMode;
  byId<HTMLSelectElement>("guideline-profile-input").value = state.guidelineProfile;
  byId<HTMLInputElement>("target-input").value = String(state.customTarget);
  byId<HTMLElement>("guideline-fields").hidden = state.targetMode !== "guideline";
  byId<HTMLElement>("custom-target-fields").hidden = state.targetMode !== "custom";
  byId<HTMLSelectElement>("reminder-mode-input").value = state.reminderMode;
  const reminderInput = byId<HTMLInputElement>("reminder-value-input");
  reminderInput.type = state.reminderMode === "interval" ? "number" : "time";
  reminderInput.min = state.reminderMode === "interval" ? "15" : "";
  reminderInput.max = state.reminderMode === "interval" ? "360" : "";
  reminderInput.step = state.reminderMode === "interval" ? "15" : "60";
  reminderInput.value = state.reminderValue;
  byId<HTMLElement>("reminder-value-label").textContent = state.reminderMode === "interval" ? t("reminders.intervalLabel") : t("reminders.fixedLabel");
  byId<HTMLSelectElement>("language-input").value = getLocale();
  byId<HTMLElement>("water-label").textContent = `${state.waterDone} / ${target} ml`;
  byId<HTMLElement>("water-progress").style.width = `${progress}%`;
  byId<HTMLElement>("water-remaining").textContent = state.waterDone >= target ? t("hydration.goalDone") : t("hydration.remaining", { amount: Math.max(0, target - state.waterDone) });
  document.documentElement.dataset.reduceMotion = state.reduceMotion ? "true" : "false";
  document.documentElement.style.setProperty("--pet-size", `${state.petSize}px`);
  document.documentElement.style.setProperty("--pet-accent", pet.accent);
  setPetAction(currentAction, 0);
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

const resetWaterForNewDay = () => {
  if (state.waterDate === localDateKey()) return;
  state.waterDate = localDateKey();
  state.waterDone = 0;
  state.lastHydrationReminderKey = "";
  state.lastHydrationReminderAt = Date.now();
  saveState();
};

const recordWater = (amount: number) => {
  resetWaterForNewDay();
  const target = targetAmount();
  const wasComplete = state.waterDone >= target;
  state.waterDone += amount;
  saveState();
  render();
  setPetAction(state.waterDone >= target && !wasComplete ? "happy" : "drink", 1200);
  const remaining = Math.max(0, target - state.waterDone);
  showMessage(t(state.waterDone >= target ? "messages.hydrationGoalDone" : "messages.hydrationRecorded", {
    amount,
    done: state.waterDone,
    remaining,
    target,
  }), 5200);
};

const checkReminders = () => {
  resetWaterForNewDay();
  const now = new Date();
  const target = targetAmount();
  let hydrationDue = false;
  if (state.waterDone < target && state.reminderMode === "interval") {
    const intervalMinutes = Math.max(15, Number(state.reminderValue) || 60);
    hydrationDue = Date.now() - state.lastHydrationReminderAt >= intervalMinutes * 60_000;
  } else if (state.waterDone < target) {
    const minuteKey = `${localDateKey(now)}-${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    hydrationDue = state.reminderValue === minuteKey.slice(-5) && state.lastHydrationReminderKey !== minuteKey;
    if (hydrationDue) state.lastHydrationReminderKey = minuteKey;
  }
  if (hydrationDue) {
    state.lastHydrationReminderAt = Date.now();
    setPetAction("remind", 1800);
    showMessage(t("messages.reminder"), 5000);
    void notify(t("actions.drink"), t("messages.notificationBody", { done: state.waterDone, target }));
  }

  let todoChanged = false;
  for (const todo of state.todos) {
    if (!todo.done && !todo.notified && todo.remindAt && new Date(todo.remindAt).getTime() <= Date.now()) {
      todo.notified = true;
      todoChanged = true;
      setPetAction("remind", 1800);
      showMessage(t("messages.todoReminder", { todo: todo.title }), 5000);
      void notify(t("todo.notificationTitle"), todo.title);
    }
  }
  if (hydrationDue || todoChanged) saveState();
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

byId<HTMLSelectElement>("pet-select").innerHTML = pets.map((pet) => `<option value="${pet.id}">${t(pet.nameKey)}</option>`).join("");

byId("settings-button").addEventListener("click", () => void setPanelOpen(true));
byId("context-settings-button").addEventListener("click", () => void setPanelOpen(true));
byId("close-settings").addEventListener("click", () => void setPanelOpen(false));
byId("quit-button").addEventListener("click", () => void invoke("quit_app"));
byId("drink-button").addEventListener("click", () => recordWater(250));
byId("panel-drink-button").addEventListener("click", () => recordWater(250));
byId("feed-button").addEventListener("click", () => {
  setPetAction("feed", 1200);
  showMessage(t("messages.feed"));
});
byId("todo-button").addEventListener("click", () => void invoke("show_todo_window"));
petStage.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  if (panelOpen) return;
  petContextMenu.hidden = false;
  const menuWidth = petContextMenu.offsetWidth;
  const menuHeight = petContextMenu.offsetHeight;
  petContextMenu.style.left = `${Math.max(4, Math.min(event.clientX, window.innerWidth - menuWidth - 4))}px`;
  petContextMenu.style.top = `${Math.max(4, Math.min(event.clientY, window.innerHeight - menuHeight - 4))}px`;
});
document.addEventListener("pointerdown", (event) => {
  if (!petContextMenu.contains(event.target as Node)) hidePetContextMenu();
});
window.addEventListener("blur", hidePetContextMenu);
const triggerPetTouch = () => {
  setPetAction("touch", 900);
  showMessage(t("messages.petInteraction"));
};
petSurface.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || panelOpen) return;
  petPointer = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
  petSurface.setPointerCapture(event.pointerId);
});
petSurface.addEventListener("pointermove", async (event) => {
  if (!petPointer || petPointer.id !== event.pointerId || petPointer.dragging) return;
  if (Math.hypot(event.clientX - petPointer.x, event.clientY - petPointer.y) < petDragThreshold) return;
  petPointer.dragging = true;
  const horizontalDelta = event.clientX - petPointer.x;
  if (Math.abs(horizontalDelta) >= 1) petFacing = horizontalDelta < 0 ? "left" : "right";
  setPetAction("run", 0);
  try {
    await appWindow.startDragging();
    await savePosition();
  } finally {
    petPointer = undefined;
    setPetAction("idle", 0);
  }
});
petSurface.addEventListener("pointerup", (event) => {
  if (!petPointer || petPointer.id !== event.pointerId) return;
  const wasDragging = petPointer.dragging;
  petPointer = undefined;
  if (petSurface.hasPointerCapture(event.pointerId)) petSurface.releasePointerCapture(event.pointerId);
  if (!wasDragging) triggerPetTouch();
});
petSurface.addEventListener("pointercancel", () => {
  petPointer = undefined;
});
petSurface.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    triggerPetTouch();
  }
});

byId<HTMLSelectElement>("pet-select").addEventListener("change", (event) => {
  state.petId = (event.target as HTMLSelectElement).value;
  saveState();
  render();
  preloadPetAnimations(selectedPet());
  setPetAction("happy", 1000);
  showMessage(t("messages.petChanged", { pet: t(selectedPet().nameKey) }));
});
byId<HTMLInputElement>("size-input").addEventListener("input", (event) => {
  state.petSize = Number((event.target as HTMLInputElement).value);
  saveState();
  render();
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
byId<HTMLSelectElement>("target-mode-input").addEventListener("change", (event) => {
  state.targetMode = (event.target as HTMLSelectElement).value as TargetMode;
  state.waterDone = Math.min(state.waterDone, targetAmount());
  saveState();
  render();
});
byId<HTMLSelectElement>("guideline-profile-input").addEventListener("change", (event) => {
  state.guidelineProfile = (event.target as HTMLSelectElement).value as GuidelineProfile;
  state.waterDone = Math.min(state.waterDone, targetAmount());
  saveState();
  render();
});
byId<HTMLInputElement>("target-input").addEventListener("change", (event) => {
  state.customTarget = Math.max(200, Math.min(5000, Number((event.target as HTMLInputElement).value) || 1600));
  state.waterDone = Math.min(state.waterDone, targetAmount());
  saveState();
  render();
});
byId<HTMLSelectElement>("reminder-mode-input").addEventListener("change", (event) => {
  state.reminderMode = (event.target as HTMLSelectElement).value as ReminderMode;
  state.reminderValue = state.reminderMode === "interval" ? "60" : "10:00";
  state.lastHydrationReminderAt = Date.now();
  saveState();
  render();
});
byId<HTMLInputElement>("reminder-value-input").addEventListener("change", (event) => {
  state.reminderValue = (event.target as HTMLInputElement).value;
  state.lastHydrationReminderAt = Date.now();
  saveState();
});
const bootstrap = async () => {
  render();
  preloadPetAnimations(selectedPet());
  stopTodoSync = await listen<Todo[]>(todoEventName, ({ payload }) => {
    state.todos = payload.map(normalizeTodo);
    saveState();
  });
  await appWindow.setTitle(t("app.title"));
  await appWindow.setAlwaysOnTop(state.alwaysOnTop);
  await appWindow.setSize(collapsedWindowSize());
  await restorePosition();
  try {
    state.autostart = await isAutostartEnabled();
    saveState();
    render();
  } catch {
    // The plugin can be unavailable in a browser-only preview.
  }
  checkReminders();
  reminderTimer = window.setInterval(checkReminders, 15_000);
};

void bootstrap();
window.addEventListener("beforeunload", () => {
  if (reminderTimer) window.clearInterval(reminderTimer);
  if (actionTimer) window.clearTimeout(actionTimer);
  if (messageTimer) window.clearTimeout(messageTimer);
  stopTodoSync?.();
  void savePosition();
});
