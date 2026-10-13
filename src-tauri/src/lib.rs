use std::{fs::OpenOptions, path::PathBuf};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconEvent},
    Manager, WindowEvent,
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

fn setup_tray(app: &tauri::App) {
    let tray_locale = locale::load();
    let Some(tray) = app.tray_by_id("desktop-pet-tray") else {
        eprintln!("desktop pet tray setup failed: configured tray icon is missing");
        return;
    };

    if let Err(error) = tray.set_visible(true) {
        eprintln!("desktop pet tray visibility failed: {error}");
    }
    if let Err(error) = tray.set_tooltip(Some(&tray_locale.tooltip)) {
        eprintln!("desktop pet tray tooltip failed: {error}");
    }

    let menu: tauri::Result<Menu<tauri::Wry>> = (|| {
        let show = MenuItem::with_id(app, "show", &tray_locale.show, true, None::<&str>)?;
        let hide = MenuItem::with_id(app, "hide", &tray_locale.hide, true, None::<&str>)?;
        let quit = MenuItem::with_id(app, "quit", &tray_locale.quit, true, None::<&str>)?;
        Menu::with_items(app, &[&show, &hide, &quit])
    })();
    match menu {
        Ok(menu) => {
            if let Err(error) = tray.set_menu(Some(menu)) {
                eprintln!("desktop pet tray menu failed: {error}");
            }
        }
        Err(error) => eprintln!("desktop pet tray menu creation failed: {error}"),
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
        .invoke_handler(tauri::generate_handler![quit_app, show_todo_window])
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            setup_tray(app);
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

    app.run(|_, _| {});
}
