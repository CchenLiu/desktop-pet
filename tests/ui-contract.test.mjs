import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

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
  assert.match(styles, /\.settings-trigger,[\s\S]*\.quick-actions \{ opacity: 0; pointer-events: none;/);
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

  assert.equal(todoWindow.width, 476);
  assert.ok(todoWindow.height <= 660);
  assert.equal(todoWindow.resizable, false);
  assert.equal(todoWindow.decorations, false);
  assert.equal(todoWindow.transparent, true);
  assert.equal(todoWindow.shadow, false);
  assert.equal(todoWindow.backgroundColor, "#00000000");
  assert.match(todo, /data-tauri-drag-region/);
  assert.match(todo, /id="close-todo"/);
  assert.match(todo, /todoWindow\.hide\(\)/);
  assert.match(styles, /\.todo-window\s*\{/);
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
  const styles = read("src/styles.css");

  assert.match(styles, /\.settings-trigger \{[^}]*top: 16px;[^}]*right: 16px;/);
  assert.match(styles, /\.quick-actions \{[^}]*bottom: 14px;/);
  assert.match(styles, /\.settings-panel \{[^}]*inset: 28px;/);
});

test("hydration feedback reports amount, total, target, and remaining water", () => {
  const main = read("src/main.ts");
  const zh = read("src/i18n/zh-CN.ts");
  const en = read("src/i18n/en-US.ts");

  assert.match(main, /state\.waterDone \+= amount/);
  assert.match(main, /remaining = Math\.max\(0, target - state\.waterDone\)/);
  for (const locale of [zh, en]) {
    assert.match(locale, /hydrationRecorded:.*\{\{amount\}\}/);
    assert.match(locale, /hydrationRecorded:.*\{\{done\}\}/);
    assert.match(locale, /hydrationRecorded:.*\{\{target\}\}/);
    assert.match(locale, /hydrationRecorded:.*\{\{remaining\}\}/);
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

test("pet sprite sheets use isolated 4 by 4 cells and higher frame rates", () => {
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

  assert.match(main, /id === "alaskan" && action === "touch"[\s\S]*\[0, 1, 2, 3, 2, 1, 0/);
  assert.match(main, /id === "shepherd" && action === "feed"[\s\S]*5, 5, 5, 5, 5/);
  assert.match(main, /id === "maine-coon" \? "green-fringe"/);
  assert.match(player, /asset\.frameMap\?\.\[frame\] \?\? frame/);
  assert.match(player, /cleanGreenFringe/);
  assert.match(player, /imageSmoothingQuality = "high"/);
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
  assert.match(rust, /generate_handler!\[quit_app, show_todo_window\]/);
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
