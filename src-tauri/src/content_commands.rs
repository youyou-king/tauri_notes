use crate::command_error::CommandError;
use tauri_notes_content::{assets, references};

#[tauri::command]
pub async fn list_reference_targets(
    workspace: String,
) -> Result<Vec<references::ReferenceTarget>, CommandError> {
    references::list_reference_targets(workspace).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn relink_reference(
    workspace: String,
    reference_id: String,
    target_document_id: String,
    target_block_id: String,
) -> Result<(), CommandError> {
    references::relink_reference(
        workspace,
        reference_id,
        target_document_id,
        target_block_id,
    )
    .await
    .map_err(CommandError::from)
}

#[tauri::command]
pub async fn load_reference_preview(
    workspace: String,
    reference_id: String,
) -> Result<references::ReferencePreview, CommandError> {
    references::load_reference_preview(workspace, reference_id).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn save_note_image_asset(
    workspace: String,
    document_id: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<String, CommandError> {
    assets::save_note_image_asset(workspace, document_id, file_name, bytes).await.map_err(CommandError::from)
}

#[tauri::command]
pub fn save_image_asset(
    workspace: String,
    document_id: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<String, CommandError> {
    assets::save_image_asset(workspace, document_id, file_name, bytes).map_err(CommandError::from)
}

#[tauri::command]
pub fn copy_image_asset(
    workspace: String,
    document_id: String,
    source_path: String,
) -> Result<String, CommandError> {
    assets::copy_image_asset(workspace, document_id, source_path).map_err(CommandError::from)
}
