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

test("pet context menu uses a native cursor-positioned menu without resizing the pet window", () => {
  const main = read("src/main.ts");
  const rust = read("src-tauri/src/lib.rs");
  const styles = read("src/styles.css");

  assert.match(main, /invoke\("show_pet_menu"\)/);
  assert.doesNotMatch(main, /id="pet-context-menu"/);
  assert.match(rust, /fn show_pet_menu/);
  assert.match(rust, /window\.popup_menu\(&menu\)/);
  assert.match(rust, /window\.emit\("open-settings"/);
  assert.match(styles, /\.settings-trigger,[\s\S]*\.quick-actions \{ opacity: 0; pointer-events: none;/);
});

test("native tray has an explicit icon, left-click restore, and a registered quit command", () => {
  const rust = read("src-tauri/src/lib.rs");
  const cargo = read("src-tauri/Cargo.toml");

  assert.match(rust, /include_bytes!\("\.\.\/icons\/32x32\.png"\)/);
  assert.match(rust, /Image::from_app_icon_resource\(32\)/);
  assert.match(rust, /\.icon\(tray_icon\)/);
  assert.doesNotMatch(rust, /system tray is unavailable/);
  assert.match(rust, /\.show_menu_on_left_click\(false\)/);
  assert.match(rust, /TrayIconEvent::Click/);
  assert.match(rust, /MouseButton::Left/);
  assert.match(rust, /fn quit_app/);
  assert.match(rust, /generate_handler!\[quit_app, show_pet_menu\]/);
  assert.match(cargo, /"image-png"/);
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
