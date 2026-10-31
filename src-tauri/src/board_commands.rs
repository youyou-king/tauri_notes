use crate::command_error::CommandError;
use tauri_notes_board::{Board, BoardSummary};

#[tauri::command]
pub async fn list_boards_db(workspace: String) -> Result<Vec<BoardSummary>, CommandError> {
    tauri_notes_board::list_boards_db(workspace).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn read_board_db(
    workspace: String,
    board_id: String,
) -> Result<Board, CommandError> {
    tauri_notes_board::read_board_db(workspace, board_id).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn save_board_db(workspace: String, board: Board) -> Result<(), CommandError> {
    tauri_notes_board::save_board_db(workspace, board).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn delete_board_db(
    workspace: String,
    board_id: String,
) -> Result<(), CommandError> {
    tauri_notes_board::delete_board_db(workspace, board_id).await.map_err(CommandError::from)
}
