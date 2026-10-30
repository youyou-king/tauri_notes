use tauri_notes_content::{assets, references};

#[tauri::command]
pub async fn list_reference_targets(
    workspace: String,
) -> Result<Vec<references::ReferenceTarget>, String> {
    references::list_reference_targets(workspace).await
}

#[tauri::command]
pub async fn relink_reference(
    workspace: String,
    reference_id: String,
    target_document_id: String,
    target_block_id: String,
) -> Result<(), String> {
    references::relink_reference(
        workspace,
        reference_id,
        target_document_id,
        target_block_id,
    )
    .await
}

#[tauri::command]
pub async fn load_reference_preview(
    workspace: String,
    reference_id: String,
) -> Result<references::ReferencePreview, String> {
    references::load_reference_preview(workspace, reference_id).await
}

#[tauri::command]
pub async fn save_note_image_asset(
    workspace: String,
    document_id: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    assets::save_note_image_asset(workspace, document_id, file_name, bytes).await
}

#[tauri::command]
pub fn save_image_asset(
    workspace: String,
    document_id: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    assets::save_image_asset(workspace, document_id, file_name, bytes)
}

#[tauri::command]
pub fn copy_image_asset(
    workspace: String,
    document_id: String,
    source_path: String,
) -> Result<String, String> {
    assets::copy_image_asset(workspace, document_id, source_path)
}
