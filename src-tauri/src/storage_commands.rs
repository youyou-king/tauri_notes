use tauri_notes_storage::database::{self, DatabaseStatus};

#[tauri::command]
pub async fn initialize_database(
    workspace: String,
) -> Result<DatabaseStatus, String> {
    database::initialize_database(workspace).await
}

#[tauri::command]
pub async fn database_status(
    workspace: String,
) -> Result<DatabaseStatus, String> {
    database::database_status(workspace).await
}

#[tauri::command]
pub async fn backup_database(workspace: String) -> Result<String, String> {
    database::backup_database(workspace).await
}

#[tauri::command]
pub async fn verify_database(workspace: String) -> Result<(), String> {
    database::verify_database(workspace).await
}
