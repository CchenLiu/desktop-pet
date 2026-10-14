import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const importTypeScriptModule = async (path) => {
  const output = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
};

test("collapsed pet window is transparent and has no native shadow frame", () => {
  const config = JSON.parse(read("src-tauri/tauri.conf.json"));
  const window = config.app.windows.find(({ label }) => label === "main");

  assert.equal(window.transparent, true);
  assert.equal(window.decorations, false);
  assert.equal(window.shadow, false);
  assert.equal(window.backgroundColor, "#00000000");
});

test("pet context menu keeps the custom styled surface", () => {
  const main = read("src/main.ts");
  const rust = read("src-tauri/src/lib.rs");
  const styles = read("src/styles.css");

  assert.match(main, /id="pet-context-menu"/);
  assert.match(main, /id="context-settings-button"/);
  assert.match(main, /id="quit-button"/);
  assert.doesNotMatch(main, /invoke\("show_pet_menu"\)/);
  assert.doesNotMatch(rust, /fn show_pet_menu/);
  assert.match(styles, /\.pet-context-menu \{/);
  assert.match(styles, /\.pet-controls \{[^}]*opacity: 0;[^}]*pointer-events: none;/);
});

test("native tray has an explicit icon, left-click restore, and a registered quit command", () => {
  const rust = read("src-tauri/src/lib.rs");
  const config = JSON.parse(read("src-tauri/tauri.conf.json"));
  const cargo = read("src-tauri/Cargo.toml");

  assert.equal(config.app.trayIcon, undefined);
  assert.match(rust, /TrayIconBuilder::with_id\("desktop-pet-tray"\)/);
  assert.match(rust, /Image::from_bytes\(include_bytes!\("\.\.\/icons\/32x32\.png"\)\)/);
  assert.match(rust, /\.icon\(icon\)/);
  assert.match(rust, /\.menu\(&menu\)/);
  assert.match(rust, /\.show_menu_on_left_click\(false\)/);
  assert.match(rust, /RunEvent::Ready/);
  assert.match(rust, /setup_tray\(app_handle\)/);
  assert.doesNotMatch(rust, /app\.manage\(tray\)/);
  assert.doesNotMatch(rust, /system tray is unavailable/);
  assert.match(rust, /TrayIconEvent::Click/);
  assert.match(rust, /MouseButton::Left/);
  assert.match(rust, /fn quit_app/);
  assert.match(rust, /generate_handler!\[[^\]]*quit_app/);
  assert.doesNotMatch(rust, /RunEvent::ExitRequested/);
  assert.doesNotMatch(rust, /api\.prevent_exit\(\)/);
  assert.match(cargo, /"image-png"/);
});

test("todo window is compact, frameless, transparent, and has an in-app close control", () => {
  const config = JSON.parse(read("src-tauri/tauri.conf.json"));
  const todoWindow = config.app.windows.find(({ label }) => label === "todo");
  const todo = read("src/todo.ts");
  const styles = read("src/todo.css");

  assert.ok(todoWindow.width >= 460);
  assert.ok(todoWindow.height <= 420);
  assert.notEqual(todoWindow.center, true);
  assert.equal(todoWindow.resizable, false);
  assert.equal(todoWindow.decorations, false);
  assert.equal(todoWindow.transparent, true);
  assert.equal(todoWindow.shadow, false);
  assert.equal(todoWindow.backgroundColor, "#00000000");
  assert.match(todo, /data-tauri-drag-region/);
  assert.match(todo, /id="close-todo"/);
  assert.doesNotMatch(todo, /class="todo-titlebar"/);
  assert.doesNotMatch(todo, /todo\.eyebrow/);
  assert.match(todo, /id="reminder-button"/);
  assert.match(todo, /id="priority-button"/);
  assert.match(todo, /id="todo-results"/);
  assert.match(todo, /results\.hidden = todos\.length === 0/);
  assert.match(todo, /new LogicalSize\(480, targetHeight\)/);
  assert.doesNotMatch(todo, /todo\.empty/);
  assert.match(todo, /todoWindow\.hide\(\)/);
  assert.match(todo, /listen<string>\("todo-window-open"/);
  assert.match(styles, /\.todo-window\s*\{/);
  assert.match(styles, /@keyframes todo-slide-(?:left|right)/);
  assert.match(styles, /body \{[^}]*padding: 20px;/);
  assert.match(styles, /\.composer-row \{[^}]*grid-template-columns: minmax\(0, 1fr\) 34px 34px auto;/);
});

test("escape closes settings and todo while todo close uses an allowed hide command", () => {
  const capabilities = JSON.parse(read("src-tauri/capabilities/default.json"));
  const main = read("src/main.ts");
  const todo = read("src/todo.ts");

  assert.ok(capabilities.permissions.includes("core:window:allow-hide"));
  assert.match(todo, /const closeTodoWindow = \(\) =>/);
  assert.match(todo, /byId\("close-todo"\)\.addEventListener\("click", closeTodoWindow\)/);
  assert.match(todo, /event\.key !== "Escape"/);
  assert.match(todo, /invoke\("hide_reminder_picker"\)/);
  assert.match(todo, /closeTodoWindow\(\)/);
  assert.match(main, /event\.key === "Escape" && panelOpen/);
  assert.match(main, /setPanelOpen\(false\)/);
});

test("todo reminder requires explicit confirmation and can be cancelled", () => {
  const config = JSON.parse(read("src-tauri/tauri.conf.json"));
  const capabilities = JSON.parse(read("src-tauri/capabilities/default.json"));
  const todo = read("src/todo.ts");
  const picker = read("src/reminder-picker.ts");
  const styles = read("src/reminder-picker.css");
  const rust = read("src-tauri/src/lib.rs");
  const vite = read("vite.config.ts");
  const zhCN = read("src/i18n/zh-CN.ts");
  const enUS = read("src/i18n/en-US.ts");
  const pickerWindow = config.app.windows.find(({ label }) => label === "reminder-picker");
  const todoWindow = config.app.windows.find(({ label }) => label === "todo");

  assert.equal(pickerWindow.url, "reminder.html");
  assert.ok(pickerWindow.width >= 350 && pickerWindow.width <= 380);
  assert.ok(pickerWindow.height >= 370 && pickerWindow.height <= 390);
  assert.equal(pickerWindow.decorations, false);
  assert.equal(pickerWindow.transparent, true);
  assert.equal(todoWindow.alwaysOnTop, true);
  assert.equal(pickerWindow.alwaysOnTop, todoWindow.alwaysOnTop);
  assert.ok(capabilities.windows.includes("reminder-picker"));
  assert.match(vite, /reminder:.*reminder\.html/);
  assert.match(todo, /getBoundingClientRect\(\)/);
  assert.match(todo, /invoke\("show_reminder_picker", \{[\s\S]*?anchorX:[\s\S]*?anchorTop:[\s\S]*?anchorBottom:/);
  assert.match(todo, /listen<string>\("reminder-picker-confirm"/);
  assert.doesNotMatch(todo, /id="reminder-popover"/);
  assert.doesNotMatch(todo, /calendarOpen \? 420/);
  assert.match(picker, /id="reminder-confirm"/);
  assert.match(picker, /id="reminder-cancel"/);
  assert.match(picker, /class="calendar-grid"/);
  assert.match(picker, /data-calendar-day/);
  assert.match(picker, /id="reminder-time" type="time"/);
  assert.match(picker, /emitTo\("todo", "reminder-picker-confirm"/);
  assert.match(picker, /const confirmPicker = \(\) =>/);
  assert.match(picker, /timeInput\.addEventListener\("change", \(\) => timeInput\.blur\(\)\)/);
  assert.match(picker, /timeInput\.addEventListener\("dblclick",[\s\S]*?confirmPicker\(\)/);
  assert.match(picker, /timeInput\.addEventListener\("keydown",[\s\S]*?event\.key !== "Enter"[\s\S]*?confirmPicker\(\)/);
  assert.match(picker, /byId\("reminder-confirm"\)\.addEventListener\("click", confirmPicker\)/);
  assert.match(picker, /event\.key !== "Escape"/);
  const headerStart = picker.indexOf('<header class="picker-header"');
  const headerEnd = picker.indexOf("</header>", headerStart);
  const cancelButton = picker.indexOf('id="reminder-cancel"');
  const confirmButton = picker.indexOf('id="reminder-confirm"');
  assert.ok(cancelButton > headerStart && cancelButton < headerEnd);
  assert.ok(confirmButton > headerStart && confirmButton < headerEnd);
  assert.ok(cancelButton < confirmButton);
  assert.doesNotMatch(picker, /<footer class="picker-actions">/);
  assert.match(styles, /body \{[^}]*padding: 28px 28px 36px;/);
  assert.match(styles, /\.picker-window \{[^}]*height: auto;/);
  assert.match(styles, /\.picker-window \{[^}]*box-shadow: 0 14px 28px -14px/);
  assert.doesNotMatch(styles, /0 16px 34px/);
  assert.match(rust, /fn show_reminder_picker/);
  assert.match(rust, /get_webview_window\("reminder-picker"\)/);
  assert.match(rust, /anchor_x: f64/);
  assert.match(rust, /anchor_top: f64/);
  assert.match(rust, /anchor_bottom: f64/);
  assert.match(rust, /todo_position\.x[\s\S]*anchor_x[\s\S]*scale/);
  assert.match(rust, /emit\("reminder-picker-open"/);
  assert.match(todo, /let confirmedReminder = ""/);
  assert.match(todo, /remindAt: confirmedReminder/);
  assert.match(zhCN, /confirmReminder: "确认提醒时间"/);
  assert.match(zhCN, /cancelReminder: "取消本次设置"/);
  assert.match(enUS, /confirmReminder: "Confirm reminder time"/);
  assert.match(enUS, /cancelReminder: "Cancel this change"/);
  assert.match(zhCN, /confirmTimeHint: "选择时间后双击即可确认"/);
  assert.match(enUS, /confirmTimeHint: "Double-click after choosing a time to confirm"/);
});

test("always-on-top preference stays synchronized across pet, todo, and reminder windows", () => {
  const main = read("src/main.ts");

  assert.match(main, /getAllWindows/);
  assert.match(main, /const syncAlwaysOnTop = async/);
  assert.match(main, /\["main", "todo", "reminder-picker"\]/);
  assert.match(main, /window\.setAlwaysOnTop\(alwaysOnTop\)/);
  assert.match(main, /await syncAlwaysOnTop\(state\.alwaysOnTop\)/);
});

test("due todo reminders are checked immediately after sync and every second", () => {
  const main = read("src/main.ts");
  const engine = read("src/reminder-engine.ts");

  assert.match(main, /const runReminderChecks = \(now = Date\.now\(\)\)/);
  assert.match(main, /findNextDueTodo\(state\.todos, now\)/);
  assert.match(engine, /new Date\(todo\.remindAt\)\.getTime\(\)/);
  assert.match(engine, /dueAt <= now/);
  assert.match(main, /showPersistentReminder\(t\("messages\.todoReminder"/);
  assert.match(main, /setInterval\(runReminderChecks, 1_000\)/);
  assert.match(main, /listen<Todo\[]>\(todoEventName,[\s\S]*?runReminderChecks\(\)/);
});

test("todo due-time predicate handles due, future, completed, and notified tasks", async () => {
  const { acknowledgeTodoReminder, findNextDueTodo, isTodoReminderDue, migrateTodoAcknowledgements } = await importTypeScriptModule("src/reminder-engine.ts");
  const now = Date.parse("2026-10-13T10:30:00");
  const todo = { title: "test", done: false, notified: false, remindAt: "2026-10-13T10:30" };

  assert.equal(isTodoReminderDue(todo, now), true);
  assert.equal(isTodoReminderDue({ ...todo, remindAt: "2026-10-13T10:31" }, now), false);
  assert.equal(isTodoReminderDue({ ...todo, done: true }, now), false);
  assert.equal(isTodoReminderDue({ ...todo, notified: true }, now), false);

  const todos = [
    { ...todo, id: "later", remindAt: "2026-10-13T10:29" },
    { ...todo, id: "first", remindAt: "2026-10-13T10:28" },
  ];
  assert.equal(findNextDueTodo(todos, now)?.id, "first");
  assert.equal(todos[1].notified, false, "showing a reminder must not acknowledge it");
  assert.equal(acknowledgeTodoReminder(todos, "first"), true);
  assert.equal(todos[1].notified, true);
  assert.equal(findNextDueTodo(todos, now)?.id, "later");

  assert.equal(migrateTodoAcknowledgements([{ ...todo, notified: true }], 0)[0].notified, false);
  assert.equal(migrateTodoAcknowledgements([{ ...todo, notified: true }], 1)[0].notified, true);
});

test("pet reminders stay visible until acknowledged and use per-pet call sprite frames", async () => {
  const main = read("src/main.ts");
  const styles = read("src/styles.css");
  const player = read("src/sprite-player.ts");
  const zh = read("src/i18n/zh-CN.ts");
  const en = read("src/i18n/en-US.ts");
  const { petActionTimelines } = await importTypeScriptModule("src/pet-animation-timelines.ts");

  assert.match(main, /id="reminder-acknowledge"/);
  assert.match(main, /const showPersistentReminder =/);
  assert.match(main, /const acknowledgeReminder =/);
  assert.match(main, /findNextDueTodo\(state\.todos, now\)/);
  assert.match(main, /acknowledgeTodoReminder\(state\.todos, activeReminder\.todoId\)/);
  assert.match(main, /migrateTodoAcknowledgements\([\s\S]*?stored\.reminderAcknowledgementVersion/);
  assert.doesNotMatch(main, /if \(isTodoReminderDue\(todo, now\)\) \{[\s\S]*?todo\.notified = true/);
  assert.match(main, /remind: animationAsset\(id, "remind", 12, true\)/);
  assert.match(main, /action === "remind" \? "generated-fringe"/);
  assert.match(player, /cleanGeneratedFringe/);
  assert.doesNotMatch(styles, /data-action="remind"[^}]*\.pet-sprite[^}]*animation:/);
  assert.doesNotMatch(styles, /@keyframes dog-alert-hop/);
  assert.doesNotMatch(styles, /@keyframes cat-alert-hop/);
  for (const pet of ["alaskan", "shepherd", "siamese", "maine-coon"]) {
    const timeline = petActionTimelines[pet].remind;
    assert.ok(timeline.reduce((total, step) => total + step.durationMs, 0) >= 2_200, `${pet}/remind should include a calm pause between calls`);
    assert.ok(timeline.some(({ frame }) => frame === 2 || frame === 6), `${pet}/remind should reach a clearly open-mouth frame`);
    const png = readFileSync(new URL(`../src/assets/pets/${pet}/animations/remind.png`, import.meta.url));
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    assert.equal(width, height, `${pet}/remind sprite sheet must be square`);
    assert.equal(width % 4, 0, `${pet}/remind sprite sheet must divide into exact grid cells`);
    assert.equal(png[25], 6, `${pet}/remind sprite sheet must retain an alpha channel`);
  }
  assert.match(zh, /acknowledgeReminder: "知道了"/);
  assert.match(en, /acknowledgeReminder: "Got it"/);
});

test("todo window opens beside the pet and stays inside the current monitor work area", () => {
  const rust = read("src-tauri/src/lib.rs");

  assert.match(rust, /get_webview_window\("main"\)/);
  assert.match(rust, /outer_position\(\)/);
  assert.match(rust, /outer_size\(\)/);
  assert.match(rust, /current_monitor\(\)/);
  assert.match(rust, /work_area\(\)/);
  assert.match(rust, /set_position\(PhysicalPosition::new/);
  assert.match(rust, /emit\("todo-window-open"/);
});

test("settings supporting text is at least eleven pixels", () => {
  const styles = read("src/styles.css");

  for (const selector of [".eyebrow", ".section-kicker", ".panel-tip", ".switch-row small", ".panel-footer"]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(styles, new RegExp(`${escaped} \\{[^}]*font(?:-size|:)[^;}]*11px`, "s"));
  }
});

test("settings expansion preserves the collapsed pet position and restores it on close", () => {
  const main = read("src/main.ts");

  assert.match(main, /collapsedPositionBeforePanel/);
  assert.match(main, /anchorExpandedWindow/);
  assert.match(main, /setPosition\(new PhysicalPosition\(collapsedPositionBeforePanel\.x/);
  assert.doesNotMatch(main, /setSize\(open[\s\S]{0,180}restorePosition\(\)/);
});

test("pet hover and settings shadows keep enough transparent gutter to avoid rectangular clipping", () => {
  const main = read("src/main.ts");
  const styles = read("src/styles.css");

  assert.match(main, /class="pet-controls"[\s\S]*class="quick-actions"[\s\S]*id="settings-button"/);
  assert.match(styles, /\.pet-controls \{[^}]*bottom: 14px;/);
  assert.match(styles, /\.settings-trigger \{[^}]*position: relative;/);
  assert.doesNotMatch(styles, /\.settings-trigger \{[^}]*top: 16px;[^}]*right: 16px;/);
  assert.match(styles, /\.quick-actions \{[^}]*display: flex;/);
  assert.match(styles, /\.settings-panel \{[^}]*inset: 28px;/);
});

test("hydration feedback reports amount, total, target, and remaining water", () => {
  const main = read("src/main.ts");
  const zh = read("src/i18n/zh-CN.ts");
  const en = read("src/i18n/en-US.ts");

  assert.match(main, /state\.waterDone \+= recordedAmount/);
  assert.match(main, /remaining = Math\.max\(0, target - state\.waterDone\)/);
  for (const locale of [zh, en]) {
    assert.match(locale, /hydrationRecorded:.*\{\{amount\}\}/);
    assert.match(locale, /hydrationRecorded:.*\{\{done\}\}/);
    assert.match(locale, /hydrationRecorded:.*\{\{target\}\}/);
    assert.match(locale, /hydrationRecorded:.*\{\{remaining\}\}/);
  }
});

test("hydration plan distributes the daily target across work-hour reminder slots", async () => {
  const { buildHydrationPlan, intervalReminderSlotKey } = await importTypeScriptModule("src/hydration-plan.ts");
  const main = read("src/main.ts");
  const zh = read("src/i18n/zh-CN.ts");
  const en = read("src/i18n/en-US.ts");
  const morning = new Date(2026, 9, 14, 9, 0, 0);
  const midday = new Date(2026, 9, 14, 12, 0, 0);

  const initial = buildHydrationPlan({
    target: 1500,
    completed: 0,
    intervalMinutes: 30,
    workStart: "09:00",
    workEnd: "18:00",
    now: morning,
  });
  assert.equal(initial.totalSlots, 18);
  assert.equal(initial.remainingSlots, 18);
  assert.equal(initial.recommendedAmount, 90);

  const behindSchedule = buildHydrationPlan({
    target: 1500,
    completed: 180,
    intervalMinutes: 30,
    workStart: "09:00",
    workEnd: "18:00",
    now: midday,
  });
  assert.equal(behindSchedule.remainingSlots, 13);
  assert.equal(behindSchedule.recommendedAmount, 110);

  assert.equal(intervalReminderSlotKey(new Date(2026, 9, 14, 8, 59), "09:00", "18:00", 30), "");
  assert.equal(intervalReminderSlotKey(new Date(2026, 9, 14, 9, 30), "09:00", "18:00", 30), "2026-10-14-09:30");
  assert.equal(intervalReminderSlotKey(new Date(2026, 9, 14, 10, 1), "09:00", "18:00", 30), "2026-10-14-10:00");
  assert.equal(intervalReminderSlotKey(new Date(2026, 9, 14, 18, 1), "09:00", "18:00", 30), "");

  assert.match(main, /workStart: "09:00"/);
  assert.match(main, /workEnd: "18:00"/);
  assert.match(main, /id="work-start-input" type="time"/);
  assert.match(main, /id="work-end-input" type="time"/);
  assert.match(main, /const amount = recommendedHydrationAmount\(\)/);
  assert.doesNotMatch(main, /recordWater\(250\)/);
  for (const locale of [zh, en]) {
    assert.match(locale, /workStart:/);
    assert.match(locale, /workEnd:/);
    assert.match(locale, /drinkAmount:/);
  }
});

test("expanded settings panel keeps the redesigned hierarchy", () => {
  const main = read("src/main.ts");
  const styles = read("src/styles.css");

  assert.match(main, /class="panel-pet-preview"/);
  assert.match(main, /class="hydration-card"/);
  assert.match(main, /class="switch-stack"/);
  assert.match(main, /class="panel-footer"/);
  assert.match(styles, /\.panel-scroll/);
  assert.match(styles, /\.hydration-card/);
});

test("all four pets use complete frame-based sprite animation sets", () => {
  const main = read("src/main.ts");
  const player = read("src/sprite-player.ts");

  assert.match(main, /canvas class="pet-sprite"/);
  for (const pet of ["alaskan", "shepherd", "siamese", "maine-coon"]) {
    assert.match(main, new RegExp(`skin: animatedSkin\\("${pet}"\\)`));
  }
  for (const action of ["idle", "touch", "drink", "feed", "run"]) {
    assert.match(main, new RegExp(`${action}: animationAsset\\(id, "${action}"`));
  }
  assert.match(player, /requestAnimationFrame/);
  assert.match(player, /context\.drawImage/);
});

test("feeding and drinking use per-pet enter-loop-exit timelines lasting at least 2.8 seconds", async () => {
  const { petActionTimelines } = await importTypeScriptModule("src/pet-animation-timelines.ts");
  const player = read("src/sprite-player.ts");
  const skin = read("src/pet-skin.ts");
  const main = read("src/main.ts");

  for (const pet of ["alaskan", "shepherd", "siamese", "maine-coon"]) {
    const drink = petActionTimelines[pet].drink;
    assert.ok(drink.length > 24, `${pet}/drink should repeat its middle action frames`);
    assert.ok(drink.reduce((total, step) => total + step.durationMs, 0) >= 2_800, `${pet}/drink should last at least 2.8 seconds`);

    const feed = petActionTimelines[pet].feed;
    assert.ok(feed.length >= 18 && feed.length <= 24, `${pet}/feed should avoid rapid excessive mouth switching`);
    assert.ok(feed.filter(({ durationMs }) => durationMs >= 170).length >= 8, `${pet}/feed should hold gentle chew frames long enough`);
    assert.ok(feed.reduce((total, step) => total + step.durationMs, 0) >= 2_800, `${pet}/feed should last at least 2.8 seconds`);
    assert.ok(new Set(feed.map(({ frame }) => frame)).size < feed.length, `${pet}/feed should retain a gentle chew loop`);
  }
  assert.match(main, /timeline: petActionTimelines\[id\]\?\.\[action\]/);
  assert.match(skin, /timeline\?: AnimationFrameStep\[\]/);
  assert.match(skin, /animationDurationMs/);
  assert.match(skin, /animationFrameAt/);
  assert.match(player, /animationFrameSampleAt\(asset, elapsedMs\)/);
});

test("idle animation stays active with a short natural pause and blended frame transitions", async () => {
  const { petActionTimelines } = await importTypeScriptModule("src/pet-animation-timelines.ts");
  const { animationFrameSampleAt } = await importTypeScriptModule("src/pet-skin.ts");
  const main = read("src/main.ts");
  const player = read("src/sprite-player.ts");
  const styles = read("src/styles.css");

  for (const pet of ["alaskan", "shepherd", "siamese", "maine-coon"]) {
    const idle = petActionTimelines[pet].idle;
    const totalDuration = idle.reduce((total, step) => total + step.durationMs, 0);
    const restingDuration = idle
      .filter(({ frame }) => frame === 0)
      .reduce((total, step) => total + step.durationMs, 0);
    const maximumDuration = pet === "shepherd" ? 4_500 : 3_600;
    assert.ok(totalDuration >= 2_800 && totalDuration <= maximumDuration, `${pet}/idle should keep moving without an extended freeze`);
    assert.ok(restingDuration >= 500 && restingDuration <= 1_000, `${pet}/idle should use only a short natural pause`);
    assert.ok(idle.every(({ durationMs }) => durationMs >= 140), `${pet}/idle frames should not flicker rapidly`);
  }

  const sample = animationFrameSampleAt({
    src: "idle.png", frames: 2, columns: 2, rows: 1, fps: 10, loop: true,
    blendFrames: true,
    timeline: [{ frame: 0, durationMs: 150 }, { frame: 1, durationMs: 150 }],
  }, 135);
  assert.equal(sample.frame, 0);
  assert.equal(sample.nextFrame, 1);
  assert.ok(sample.blend > 0 && sample.blend < 1);
  assert.match(main, /blendFrames: action === "idle"/);
  assert.match(player, /animationFrameSampleAt\(asset, elapsedMs\)/);
  assert.match(player, /drawFrame\(frame, 1\)/);
  assert.doesNotMatch(player, /drawFrame\(frame, nextFrame === frame \? 1 : 1 - blend\)/);
  assert.match(styles, /animation: idle-breathe 4\.8s/);
  assert.match(styles, /translateY\(-1px\) scale\(1\.004\)/);
  assert.doesNotMatch(styles, /translateY\(-2px\) scale\(1\.012\)/);
});

test("pet sprite sheets use isolated 4 by 4 cells and action-appropriate frame rates", () => {
  const main = read("src/main.ts");
  assert.match(main, /idle: animationAsset\(id, "idle", 10, true\)/);
  assert.match(main, /touch: animationAsset\(id, "touch", 16, false\)/);
  assert.match(main, /drink: animationAsset\(id, "drink", 16, false\)/);
  assert.match(main, /feed: animationAsset\(id, "feed", 16, false\)/);
  assert.match(main, /run: animationAsset\(id, "run", 20, true\)/);
  for (const pet of ["alaskan", "shepherd", "siamese", "maine-coon"]) {
    for (const action of ["idle", "touch", "drink", "feed", "run"]) {
      const png = readFileSync(new URL(`../src/assets/pets/${pet}/animations/${action}.png`, import.meta.url));
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      assert.equal(width, height, `${pet}/${action} sprite sheet must be square`);
      assert.equal(width % 4, 0, `${pet}/${action} sprite sheet must divide into exact grid cells`);
      assert.equal(png[25], 6, `${pet}/${action} sprite sheet must retain an alpha channel`);
    }
  }
});

test("problem animation sets keep stable frame maps and clean high-quality Maine Coon edges", () => {
  const main = read("src/main.ts");
  const player = read("src/sprite-player.ts");
  const timelines = read("src/pet-animation-timelines.ts");

  assert.match(main, /id === "alaskan" && action === "touch"[\s\S]*\[0, 1, 2, 3, 2, 1, 0/);
  assert.match(timelines, /shepherd:[\s\S]*repeat\(\[7, 8, 9, 8\], 2, 180\)/);
  assert.match(main, /id === "maine-coon" \? "green-fringe"/);
  assert.match(player, /asset\.frameMap\?\.\[targetFrame\] \?\? targetFrame/);
  assert.match(player, /cleanGreenFringe/);
  assert.match(player, /imageSmoothingQuality = "high"/);
});

test("German shepherd idle has its own goofy vacant stare and double-take rhythm", async () => {
  const { petActionTimelines } = await importTypeScriptModule("src/pet-animation-timelines.ts");
  const shepherdIdle = petActionTimelines.shepherd.idle;
  const alaskanIdle = petActionTimelines.alaskan.idle;

  assert.notDeepEqual(shepherdIdle, alaskanIdle);
  assert.ok(shepherdIdle.some(({ frame, durationMs }) => frame === 9 && durationMs >= 320), "shepherd should linger on its vacant closed-eye frame");
  assert.ok(shepherdIdle.filter(({ frame }) => frame === 14 || frame === 15).length >= 6, "shepherd should perform a silly late double-take");
  assert.ok(shepherdIdle.reduce((total, step) => total + step.durationMs, 0) >= 4_000, "shepherd's goofy beat should have deliberate comic timing");
});

test("pet interaction separates a short touch from threshold-based dragging", () => {
  const main = read("src/main.ts");
  const player = read("src/sprite-player.ts");
  assert.match(main, /const petDragThreshold = 6/);
  assert.match(main, /petSurface\.addEventListener\("pointermove"/);
  assert.match(main, /triggerPetTouch/);
  assert.match(main, /horizontalDelta < 0 \? "left" : "right"/);
  assert.match(main, /setPetAction\("run", 0\)/);
  assert.match(main, /flipX: action === "run" && petFacing === "left"/);
  assert.match(player, /context\.scale\(-1, 1\)/);
  assert.match(player, /async preload\(assets: PetAnimationAsset\[\]\)/);
  assert.match(main, /preloadPetAnimations\(selectedPet\(\)\)/);
  assert.doesNotMatch(main, /spritePlayer\.preload\(pets\.flatMap/);
  assert.doesNotMatch(main, /petSurface\.addEventListener\("pointerdown", async/);
});

test("todo quick action opens a dedicated native todo window", () => {
  const main = read("src/main.ts");
  const rust = read("src-tauri/src/lib.rs");
  const config = JSON.parse(read("src-tauri/tauri.conf.json"));
  const todoWindow = config.app.windows.find(({ label }) => label === "todo");

  assert.equal(todoWindow.url, "todo.html");
  assert.equal(todoWindow.visible, false);
  assert.equal(todoWindow.resizable, false);
  assert.match(main, /invoke\("show_todo_window"\)/);
  assert.doesNotMatch(main, /id="todo-section"/);
  assert.match(rust, /fn show_todo_window/);
  assert.match(rust, /get_webview_window\("todo"\)/);
  assert.match(rust, /generate_handler!\[[\s\S]*?quit_app,[\s\S]*?show_todo_window/);
});

test("dedicated todo list supports add, complete, delete, filters, and priority labels", () => {
  const todo = read("src/todo.ts");
  const store = read("src/todo-store.ts");
  const styles = read("src/todo.css");
  const zh = read("src/i18n/zh-CN.ts");
  const en = read("src/i18n/en-US.ts");

  assert.match(todo, /const addTodo/);
  assert.match(todo, /data-toggle=/);
  assert.match(todo, /data-delete=/);
  assert.match(todo, /data-filter=/);
  assert.match(store, /"normal" \| "important" \| "urgent"/);
  assert.match(styles, /\.priority-important/);
  assert.match(styles, /\.priority-urgent/);
  for (const locale of [zh, en]) {
    assert.match(locale, /priorityImportant:/);
    assert.match(locale, /priorityUrgent:/);
  }
});

test("tray uses the bundled PNG directly instead of the Windows executable resource", () => {
  const rust = read("src-tauri/src/lib.rs");
  const config = JSON.parse(read("src-tauri/tauri.conf.json"));
  assert.equal(config.app.trayIcon, undefined);
  assert.match(rust, /include_bytes!\("\.\.\/icons\/32x32\.png"\)/);
  assert.doesNotMatch(rust, /from_app_icon_resource/);
});

test("pet size defaults to 100 and supports a larger 220 maximum", () => {
  const main = read("src/main.ts");
  assert.match(main, /petSize: 100/);
  assert.match(main, /Math\.min\(220, next\.petSize/);
  assert.match(main, /id="size-input" type="range" min="48" max="220"/);
});

test("runtime uses a writable per-user data directory with an environment override", () => {
  const rust = read("src-tauri/src/lib.rs");
  assert.match(rust, /DESKTOP_PET_DATA_DIR/);
  assert.match(rust, /LOCALAPPDATA/);
  assert.match(rust, /join\("DesktopPet"\)/);
  assert.match(rust, /create_dir_all\(&data_dir\)/);
  assert.match(rust, /app_directories_override/);
});

test("startup probes writable data fallbacks and tray creation errors cannot abort the app", () => {
  const rust = read("src-tauri/src/lib.rs");

  assert.match(rust, /current_exe\(\)/);
  assert.match(rust, /\.desktop-pet-data/);
  assert.match(rust, /OpenOptions::new\(\)/);
  assert.match(rust, /if let Err\(error\) = result/);
  assert.doesNotMatch(rust, /setup_tray\(app\)\?;/);
  assert.doesNotMatch(rust, /setup_tray\(app\)\.expect/);
});
