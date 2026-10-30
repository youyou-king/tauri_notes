#[tauri::command]
pub fn list_custom_themes() -> Result<Vec<String>, String> {
    tauri_notes_theme::list()
}

#[tauri::command]
pub fn save_custom_theme(id: String, json: String) -> Result<(), String> {
    tauri_notes_theme::save(&id, &json)
}

#[tauri::command]
pub fn delete_custom_theme(id: String) -> Result<(), String> {
    tauri_notes_theme::delete(&id)
}
