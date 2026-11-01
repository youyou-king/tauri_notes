use crate::platform_state::PlatformState;
use tauri::State;
use tauri_notes_theme::ThemeStore;

fn store(state: &PlatformState) -> Result<ThemeStore, String> {
    Ok(ThemeStore::new(
        state.adapter.data_dir()?,
        state.adapter.legacy_theme_dir(),
    ))
}

#[tauri::command]
pub fn list_custom_themes(
    state: State<'_, PlatformState>,
) -> Result<Vec<String>, String> {
    store(&state)?.list()
}

#[tauri::command]
pub fn save_custom_theme(
    state: State<'_, PlatformState>,
    id: String,
    json: String,
) -> Result<(), String> {
    store(&state)?.save(&id, &json)
}

#[tauri::command]
pub fn delete_custom_theme(
    state: State<'_, PlatformState>,
    id: String,
) -> Result<(), String> {
    store(&state)?.delete(&id)
}