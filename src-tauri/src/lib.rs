use std::{fs::OpenOptions, path::PathBuf};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconEvent},
    Manager, RunEvent, WindowEvent,
};

mod locale;

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn show_todo_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("todo") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let tray_locale = locale::load();
    let show = MenuItem::with_id(app, "show", &tray_locale.show, true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", &tray_locale.hide, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", &tray_locale.quit, true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

    let tray = app
        .tray_by_id("desktop-pet-tray")
        .expect("configured desktop pet tray icon is missing");
    tray.set_menu(Some(menu))?;
    tray.set_tooltip(Some(&tray_locale.tooltip))?;
    Ok(())
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
        .invoke_handler(tauri::generate_handler![quit_app, show_todo_window])
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            if let Err(error) = setup_tray(app) {
                eprintln!("desktop pet tray setup failed: {error}");
            }
            Ok(())
        })
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
        .on_menu_event(|app, event| {
            if let Some(window) = app.get_webview_window("main") {
                match event.id.as_ref() {
                    "show" => {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                    "hide" => {
                        let _ = window.hide();
                    }
                    "quit" => app.exit(0),
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

    app.run(|_, event| {
        if let RunEvent::ExitRequested { api, .. } = event {
            api.prevent_exit();
        }
    });
}
