import "./reminder-picker.css";

import { emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getLocale, t } from "./i18n";

const pickerWindow = getCurrentWindow();
let selectedDate = new Date();
let calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const pad2 = (value: number) => String(value).padStart(2, "0");
const localDateValue = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

document.body.innerHTML = `
  <main class="picker-window" role="dialog" aria-label="${t("todo.calendarLabel")}">
    <header class="picker-header" data-tauri-drag-region>
      <button id="reminder-cancel" class="picker-action cancel" type="button" aria-label="${t("todo.cancelReminder")}" title="${t("todo.cancelReminder")}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
      </button>
      <div class="month-control" data-tauri-drag-region>
        <button id="calendar-previous" type="button" aria-label="${t("todo.previousMonth")}" title="${t("todo.previousMonth")}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
        </button>
        <strong id="calendar-month" data-tauri-drag-region></strong>
        <button id="calendar-next" type="button" aria-label="${t("todo.nextMonth")}" title="${t("todo.nextMonth")}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </button>
      </div>
      <button id="reminder-confirm" class="picker-action confirm" type="button" aria-label="${t("todo.confirmReminder")}" title="${t("todo.confirmReminder")}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10" /></svg>
      </button>
    </header>
    <div id="calendar-weekdays" class="calendar-weekdays" aria-hidden="true"></div>
    <div id="calendar-grid" class="calendar-grid"></div>
    <label class="native-time">
      <span>${t("todo.reminderDateTime")}</span>
      <input id="reminder-time" type="time" step="60" />
    </label>
  </main>
`;

const restoreDraft = (value: string) => {
  const fallback = new Date(Date.now() + 5 * 60_000);
  fallback.setSeconds(0, 0);
  const parsed = value ? new Date(value) : fallback;
  selectedDate = Number.isNaN(parsed.getTime()) ? fallback : parsed;
  calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  byId<HTMLInputElement>("reminder-time").value = `${pad2(selectedDate.getHours())}:${pad2(selectedDate.getMinutes())}`;
};

const reminderValue = () => {
  const time = byId<HTMLInputElement>("reminder-time").value || "00:00";
  return `${localDateValue(selectedDate)}T${time}`;
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
  const selectedKey = localDateValue(selectedDate);
  byId<HTMLElement>("calendar-grid").innerHTML = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstCell);
    day.setDate(firstCell.getDate() + index);
    const key = localDateValue(day);
    const outside = day.getMonth() !== calendarMonth.getMonth();
    return `<button type="button" data-calendar-day="${key}" class="${outside ? "outside " : ""}${key === todayKey ? "today " : ""}${key === selectedKey ? "selected" : ""}" aria-label="${new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(day)}">${day.getDate()}</button>`;
  }).join("");
};

const cancelPicker = () => {
  void emitTo("todo", "reminder-picker-cancel");
  void pickerWindow.hide();
};

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
  selectedDate = new Date(year, month - 1, day);
  calendarMonth = new Date(year, month - 1, 1);
  renderCalendar();
});
byId("reminder-cancel").addEventListener("click", cancelPicker);
byId("reminder-confirm").addEventListener("click", () => {
  void emitTo("todo", "reminder-picker-confirm", reminderValue());
  void pickerWindow.hide();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  cancelPicker();
});
void listen<string>("reminder-picker-open", ({ payload }) => {
  restoreDraft(payload);
  renderCalendar();
});
void listen("reminder-picker-close", () => void pickerWindow.hide());
void pickerWindow.setTitle(t("todo.calendarLabel"));
