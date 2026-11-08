use crate::command_error::CommandError;
use crate::platform_state::PlatformState;
use tauri::State;
use tauri_notes_board::{Board, BoardSummary};

fn resolve_workspace(
    state: &State<'_, PlatformState>,
    library_id: &str,
) -> Result<String, CommandError> {
    crate::library_resolver::resolve_workspace_path(state.inner(), library_id)
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn list_boards_db(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
) -> Result<Vec<BoardSummary>, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    tauri_notes_board::list_boards_db(workspace)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn read_board_db(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    board_id: String,
) -> Result<Board, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    tauri_notes_board::read_board_db(workspace, board_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn save_board_db(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    board: Board,
) -> Result<(), CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    tauri_notes_board::save_board_db(workspace, board)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn delete_board_db(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    board_id: String,
) -> Result<(), CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    tauri_notes_board::delete_board_db(workspace, board_id)
        .await
        .map_err(CommandError::from)
}
