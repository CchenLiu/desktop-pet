use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

mod locale;

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

fn setup_tray(app: &tauri::App) -> tauri::Result<TrayIcon> {
    let tray_locale = locale::load();
    let show = MenuItem::with_id(app, "show", &tray_locale.show, true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", &tray_locale.hide, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", &tray_locale.quit, true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

    #[cfg(target_os = "windows")]
    let tray_icon = Image::from_app_icon_resource(32)?;
    #[cfg(not(target_os = "windows"))]
    let tray_icon = Image::from_bytes(include_bytes!("../icons/32x32.png"))?;
    let tray = TrayIconBuilder::with_id("desktop-pet-tray")
        .icon(tray_icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip(&tray_locale.tooltip)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
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
        .build(app)?;
    tray.set_visible(true)?;
    Ok(tray)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut context = tauri::generate_context!();
    if let Ok(data_dir) = std::env::var("DESKTOP_PET_DATA_DIR") {
        context.config_mut().app.app_directories_override = Some(
            tauri::utils::config::AppDirectoriesOverride::Root(data_dir.into()),
        );
    }

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![quit_app])
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let tray = setup_tray(app)?;
            app.manage(tray);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(context)
        .expect("error while running desktop pet");
}
