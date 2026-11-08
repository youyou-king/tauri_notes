use crate::command_error::CommandError;
use crate::library_resolver;
use crate::platform_state::PlatformState;
use std::path::Path;
use tauri::{Manager, State};
use tauri_notes_workspace::workspace::{self, SearchHit, WorkspaceView};

fn resolve_workspace(
    state: &State<'_, PlatformState>,
    library_id: &str,
) -> Result<String, CommandError> {
    library_resolver::resolve_workspace_path(state.inner(), library_id).map_err(CommandError::from)
}

pub(crate) fn allow_workspace_assets(app: &tauri::AppHandle, path: &str) {
    let path = Path::new(path);
    let root = if path.is_dir() {
        path
    } else {
        path.parent().unwrap_or(path)
    };
    let _ = app.asset_protocol_scope().allow_directory(root, true);
}

#[tauri::command]
pub async fn create_note_file(
    app: tauri::AppHandle,
    path: String,
    title: String,
) -> Result<WorkspaceView, CommandError> {
    let view = workspace::create_note_file(path.clone(), title).await?;
    allow_workspace_assets(&app, &path);
    Ok(view)
}

#[tauri::command]
pub async fn save_note_file(path: String) -> Result<String, CommandError> {
    workspace::save_note_file(path)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn search_blocks_db(
    library_id: String,
    state: State<'_, PlatformState>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchHit>, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    workspace::search_blocks_db(workspace, query, limit)
        .await
        .map_err(CommandError::from)
}
