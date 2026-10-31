use crate::command_error::CommandError;
use tauri_notes_import::board_import::{self, BoardImportReport};
use tauri_notes_import::importer::{self, ImportReport};

#[tauri::command]
pub async fn import_markdown_workspace(
    workspace: String,
    write: bool,
) -> Result<ImportReport, CommandError> {
    importer::import_markdown_workspace(workspace, write).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn import_boards(workspace: String) -> Result<BoardImportReport, CommandError> {
    board_import::import_boards(workspace).await.map_err(CommandError::from)
}
