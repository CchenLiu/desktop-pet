use std::{fs::OpenOptions, path::PathBuf};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, PhysicalPosition, WindowEvent,
};

mod locale;

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn show_todo_window(app: tauri::AppHandle) {
    let (Some(todo), Some(pet)) = (
        app.get_webview_window("todo"),
        app.get_webview_window("main"),
    ) else {
        return;
    };

    let mut direction = "right";
    if let (Ok(pet_position), Ok(pet_size), Ok(todo_size), Ok(Some(monitor))) = (
        pet.outer_position(),
        pet.outer_size(),
        todo.outer_size(),
        pet.current_monitor(),
    ) {
        let work_area = monitor.work_area();
        let work_left = work_area.position.x;
        let work_top = work_area.position.y;
        let work_right = work_left + work_area.size.width as i32;
        let work_bottom = work_top + work_area.size.height as i32;
        let todo_width = todo_size.width as i32;
        let todo_height = todo_size.height as i32;
        let gap = 12;
        let right_x = pet_position.x + pet_size.width as i32 + gap;
        let left_x = pet_position.x - todo_width - gap;
        let max_x = (work_right - todo_width).max(work_left);
        let x = if right_x + todo_width <= work_right {
            right_x
        } else if left_x >= work_left {
            direction = "left";
            left_x
        } else {
            right_x.clamp(work_left, max_x)
        };
        let max_y = (work_bottom - todo_height).max(work_top);
        let centered_y = pet_position.y + (pet_size.height as i32 - todo_height) / 2;
        let y = centered_y.clamp(work_top, max_y);
        let _ = todo.set_position(PhysicalPosition::new(x, y));
    }

    let _ = todo.unminimize();
    let _ = todo.show();
    let _ = todo.emit("todo-window-open", direction);
    let _ = todo.set_focus();
}

#[tauri::command]
fn show_reminder_picker(
    app: tauri::AppHandle,
    value: String,
    anchor_x: f64,
    anchor_top: f64,
    anchor_bottom: f64,
) {
    let (Some(picker), Some(todo)) = (
        app.get_webview_window("reminder-picker"),
        app.get_webview_window("todo"),
    ) else {
        return;
    };

    if let (Ok(todo_position), Ok(picker_size), Ok(Some(monitor))) = (
        todo.outer_position(),
        picker.outer_size(),
        todo.current_monitor(),
    ) {
        let work_area = monitor.work_area();
        let work_left = work_area.position.x;
        let work_top = work_area.position.y;
        let work_right = work_left + work_area.size.width as i32;
        let work_bottom = work_top + work_area.size.height as i32;
        let picker_width = picker_size.width as i32;
        let picker_height = picker_size.height as i32;
        let scale = todo.scale_factor().unwrap_or(1.0);
        let anchor_screen_x = todo_position.x + (anchor_x * scale).round() as i32;
        let anchor_screen_top = todo_position.y + (anchor_top * scale).round() as i32;
        let anchor_screen_bottom = todo_position.y + (anchor_bottom * scale).round() as i32;
        let top_gutter = (28.0 * scale).round() as i32;
        let bottom_gutter = (36.0 * scale).round() as i32;
        let gap = (4.0 * scale).round() as i32;
        let preferred_x = anchor_screen_x - picker_width / 2;
        let above_y = anchor_screen_top - gap - (picker_height - bottom_gutter);
        let below_y = anchor_screen_bottom + gap - top_gutter;
        let max_x = (work_right - picker_width).max(work_left);
        let max_y = (work_bottom - picker_height).max(work_top);
        let x = preferred_x.clamp(work_left, max_x);
        let y = if above_y >= work_top {
            above_y
        } else if below_y + picker_height <= work_bottom {
            below_y
        } else {
            below_y.clamp(work_top, max_y)
        };
        let _ = picker.set_position(PhysicalPosition::new(x, y));
    }

    let _ = picker.emit("reminder-picker-open", value);
    let _ = picker.unminimize();
    let _ = picker.show();
    let _ = picker.set_focus();
}

#[tauri::command]
fn hide_reminder_picker(app: tauri::AppHandle) {
    if let Some(picker) = app.get_webview_window("reminder-picker") {
        let _ = picker.hide();
    }
}

fn setup_tray(app: &tauri::AppHandle) {
    let tray_locale = locale::load();
    let result: tauri::Result<()> = (|| {
        let show = MenuItem::with_id(app, "show", &tray_locale.show, true, None::<&str>)?;
        let hide = MenuItem::with_id(app, "hide", &tray_locale.hide, true, None::<&str>)?;
        let quit = MenuItem::with_id(app, "quit", &tray_locale.quit, true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&show, &hide, &quit])?;
        let icon = Image::from_bytes(include_bytes!("../icons/32x32.png"))?;

        TrayIconBuilder::with_id("desktop-pet-tray")
            .icon(icon)
            .menu(&menu)
            .show_menu_on_left_click(false)
            .build(app)?;
        Ok(())
    })();
    if let Err(error) = result {
        eprintln!("desktop pet tray creation failed: {error}");
    }
}

fn data_root_is_writable(path: &std::path::Path) -> bool {
    let data_dir = path.to_path_buf();
    if std::fs::create_dir_all(&data_dir).is_err() {
        return false;
    }

    let probe_path = data_dir.join(format!(".write-probe-{}", std::process::id()));
    let opened = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&probe_path);
    if opened.is_err() {
        return false;
    }
    drop(opened);
    let _ = std::fs::remove_file(probe_path);
    true
}

fn writable_data_root() -> PathBuf {
    let mut candidates = Vec::new();
    if let Some(override_path) = std::env::var_os("DESKTOP_PET_DATA_DIR") {
        candidates.push(PathBuf::from(override_path));
    }
    if let Ok(executable) = std::env::current_exe() {
        if let Some(directory) = executable.parent() {
            candidates.push(directory.join(".desktop-pet-data"));
        }
    }
    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        candidates.push(PathBuf::from(local_app_data).join("DesktopPet"));
    }
    if let Some(roaming_app_data) = std::env::var_os("APPDATA") {
        candidates.push(PathBuf::from(roaming_app_data).join("DesktopPet"));
    }
    candidates.push(std::env::temp_dir().join("DesktopPet"));

    candidates
        .into_iter()
        .find(|candidate| data_root_is_writable(candidate))
        .expect("desktop pet could not find a writable runtime data directory")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut context = tauri::generate_context!();
    let data_dir = writable_data_root();
    context.config_mut().app.app_directories_override =
        Some(tauri::utils::config::AppDirectoriesOverride::Root(data_dir));

    let app = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            quit_app,
            show_todo_window,
            show_reminder_picker,
            hide_reminder_picker
        ])
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_notification::init())
        .on_tray_icon_event(|app, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => app.exit(0),
            action => {
                let Some(window) = app.get_webview_window("main") else {
                    return;
                };
                match action {
                    "show" => {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                    "hide" => {
                        let _ = window.hide();
                    }
                    _ => {}
                }
            }
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(context)
        .expect("error while building desktop pet");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Ready = event {
            setup_tray(app_handle);
        }
    });
}
