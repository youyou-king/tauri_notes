use crate::command_error::CommandError;
use crate::library_resolver;
use crate::platform_state::PlatformState;
use tauri::State;
use tauri_notes_storage::database::{self, DatabaseStatus};

fn resolve_workspace(
    state: &State<'_, PlatformState>,
    library_id: &str,
) -> Result<String, CommandError> {
    library_resolver::resolve_workspace_path(state.inner(), library_id).map_err(CommandError::from)
}

#[tauri::command]
pub async fn database_status(
    library_id: String,
    state: State<'_, PlatformState>,
) -> Result<DatabaseStatus, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    database::database_status(workspace)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn backup_database(
    library_id: String,
    state: State<'_, PlatformState>,
) -> Result<String, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    database::backup_database(workspace)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn verify_database(
    library_id: String,
    state: State<'_, PlatformState>,
) -> Result<(), CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    database::verify_database(workspace)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn close_workspace_database(
    library_id: String,
    state: State<'_, PlatformState>,
) -> Result<(), CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    database::close_workspace_pool(&workspace).await;
    Ok(())
}
