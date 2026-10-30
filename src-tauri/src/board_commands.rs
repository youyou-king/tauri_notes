use tauri_notes_board::{Board, BoardSummary};

#[tauri::command]
pub async fn list_boards_db(workspace: String) -> Result<Vec<BoardSummary>, String> {
    tauri_notes_board::list_boards_db(workspace).await
}

#[tauri::command]
pub async fn read_board_db(
    workspace: String,
    board_id: String,
) -> Result<Board, String> {
    tauri_notes_board::read_board_db(workspace, board_id).await
}

#[tauri::command]
pub async fn save_board_db(workspace: String, board: Board) -> Result<(), String> {
    tauri_notes_board::save_board_db(workspace, board).await
}

#[tauri::command]
pub async fn delete_board_db(
    workspace: String,
    board_id: String,
) -> Result<(), String> {
    tauri_notes_board::delete_board_db(workspace, board_id).await
}
