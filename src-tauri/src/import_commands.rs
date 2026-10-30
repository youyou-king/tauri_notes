use tauri_notes_import::board_import::{self, BoardImportReport};
use tauri_notes_import::importer::{self, ImportReport};

#[tauri::command]
pub async fn import_markdown_workspace(
    workspace: String,
    write: bool,
) -> Result<ImportReport, String> {
    importer::import_markdown_workspace(workspace, write).await
}

#[tauri::command]
pub async fn import_boards(workspace: String) -> Result<BoardImportReport, String> {
    board_import::import_boards(workspace).await
}
