use tauri_notes_platform::{NativePlatform, PlatformAdapter};
use tauri_notes_theme::ThemeStore;

fn store() -> Result<ThemeStore, String> {
    let platform = NativePlatform::new();
    Ok(ThemeStore::new(
        platform.data_dir()?,
        platform.legacy_theme_dir(),
    ))
}

#[tauri::command]
pub fn list_custom_themes() -> Result<Vec<String>, String> {
    store()?.list()
}

#[tauri::command]
pub fn save_custom_theme(id: String, json: String) -> Result<(), String> {
    store()?.save(&id, &json)
}

#[tauri::command]
pub fn delete_custom_theme(id: String) -> Result<(), String> {
    store()?.delete(&id)
}