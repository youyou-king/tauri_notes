use tauri::AppHandle;

#[tauri::command]
pub fn list_custom_themes(app: AppHandle) -> Result<Vec<String>, String> {
    crate::services::theme_service::list(&app)
}

#[tauri::command]
pub fn save_custom_theme(
    app: AppHandle,
    id: String,
    json: String,
) -> Result<(), String> {
    crate::services::theme_service::save(&app, &id, &json)
}

#[tauri::command]
pub fn delete_custom_theme(app: AppHandle, id: String) -> Result<(), String> {
    crate::services::theme_service::delete(&app, &id)
}
