#[tauri::command]
pub fn list_custom_themes() -> Result<Vec<String>, String> {
    crate::services::theme_service::list()
}

#[tauri::command]
pub fn save_custom_theme(id: String, json: String) -> Result<(), String> {
    crate::services::theme_service::save(&id, &json)
}

#[tauri::command]
pub fn delete_custom_theme(id: String) -> Result<(), String> {
    crate::services::theme_service::delete(&id)
}
