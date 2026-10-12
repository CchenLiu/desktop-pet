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
    tray.set_visible(true)?;
    Ok(())
}

fn writable_data_root() -> std::path::PathBuf {
    if let Some(override_path) = std::env::var_os("DESKTOP_PET_DATA_DIR") {
        return override_path.into();
    }

    std::env::var_os("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("DesktopPet")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut context = tauri::generate_context!();
    let data_dir = writable_data_root();
    if std::fs::create_dir_all(&data_dir).is_ok() {
        context.config_mut().app.app_directories_override = Some(
            tauri::utils::config::AppDirectoriesOverride::Root(data_dir),
        );
    }

    let app = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![quit_app, show_todo_window])
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            setup_tray(app)?;
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
