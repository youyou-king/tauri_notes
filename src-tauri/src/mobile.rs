use tauri::Manager;
use crate::platform_state::PlatformState;

/// Mobile has no desktop window creation, single-instance plugin, or file
/// association registration. Tauri owns the App WebView.
pub fn prepare() {}

/// Adds mobile-only state. The platform is injected into the common command
/// layer; commands do not branch on Android/iOS.
pub fn configure(
    builder: tauri::Builder<tauri::Wry>,
) -> tauri::Builder<tauri::Wry> {
    builder.setup(|app| {
        let home = app.path().home_dir()?;
        let data = app.path().app_data_dir()?;
        let cache = app.path().app_cache_dir()?;
        app.manage(PlatformState::mobile(home, data, cache));
        Ok(())
    })
}