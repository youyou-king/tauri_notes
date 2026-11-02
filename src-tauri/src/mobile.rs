use crate::platform_state::PlatformState;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// Mobile has no desktop window creation, single-instance plugin, or file
/// association registration. Tauri owns the App WebView.
pub fn prepare() {}

/// Adds mobile-only state. The platform is injected into the common command
/// layer; commands do not branch on Android/iOS.
pub fn configure(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder.setup(|app| {
        let home = app.path().home_dir()?;
        let data = app.path().app_data_dir()?;
        let cache = app.path().app_cache_dir()?;
        app.manage(PlatformState::mobile(home, data, cache));

        // Android/iOS have no desktop-style window creation. Create the
        // single App WebView window explicitly; an empty `app.windows`
        // config otherwise leaves the native activity blank.
        if app.get_webview_window("main").is_none() {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Tauri Notes")
                .build()?;
        }
        Ok(())
    })
}
