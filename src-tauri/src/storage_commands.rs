use crate::command_error::CommandError;
use tauri_notes_storage::database::{self, DatabaseStatus};

#[tauri::command]
pub async fn initialize_database(
    workspace: String,
) -> Result<DatabaseStatus, CommandError> {
    database::initialize_database(workspace)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn database_status(
    workspace: String,
) -> Result<DatabaseStatus, CommandError> {
    database::database_status(workspace)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn backup_database(workspace: String) -> Result<String, CommandError> {
    database::backup_database(workspace)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn verify_database(workspace: String) -> Result<(), CommandError> {
    database::verify_database(workspace)
        .await
        .map_err(CommandError::from)
}
