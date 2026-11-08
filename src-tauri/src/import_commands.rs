use crate::command_error::CommandError;
use crate::library_resolver;
use crate::platform_state::PlatformState;
use tauri::State;
use tauri_notes_import::board_import::{self, BoardImportReport};
use tauri_notes_import::importer::{self, ImportReport};

fn resolve_workspace(
    state: &State<'_, PlatformState>,
    library_id: &str,
) -> Result<String, CommandError> {
    library_resolver::resolve_workspace_path(state.inner(), library_id).map_err(CommandError::from)
}

#[tauri::command]
pub async fn import_markdown_workspace(
    library_id: String,
    state: State<'_, PlatformState>,
    write: bool,
) -> Result<ImportReport, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    importer::import_markdown_workspace(workspace, write)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn import_boards(
    library_id: String,
    state: State<'_, PlatformState>,
) -> Result<BoardImportReport, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    board_import::import_boards(workspace)
        .await
        .map_err(CommandError::from)
}
