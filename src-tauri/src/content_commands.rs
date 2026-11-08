use crate::command_error::CommandError;
use crate::library_resolver;
use crate::platform_state::PlatformState;
use tauri::State;
use tauri_notes_content::{assets, references};

fn resolve_workspace(
    state: &State<'_, PlatformState>,
    library_id: &str,
) -> Result<String, CommandError> {
    library_resolver::resolve_workspace_path(state.inner(), library_id).map_err(CommandError::from)
}

#[tauri::command]
pub async fn list_reference_targets(
    library_id: String,
    state: State<'_, PlatformState>,
) -> Result<Vec<references::ReferenceTarget>, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    references::list_reference_targets(workspace)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn relink_reference(
    library_id: String,
    state: State<'_, PlatformState>,
    reference_id: String,
    target_document_id: String,
    target_block_id: String,
) -> Result<(), CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    references::relink_reference(workspace, reference_id, target_document_id, target_block_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn load_reference_preview(
    library_id: String,
    state: State<'_, PlatformState>,
    reference_id: String,
) -> Result<references::ReferencePreview, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    references::load_reference_preview(workspace, reference_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn save_note_image_asset(
    library_id: String,
    state: State<'_, PlatformState>,
    document_id: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<String, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    assets::save_note_image_asset(workspace, document_id, file_name, bytes)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn save_image_asset(
    library_id: String,
    state: State<'_, PlatformState>,
    document_id: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<String, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    assets::save_image_asset(workspace, document_id, file_name, bytes).map_err(CommandError::from)
}

#[tauri::command]
pub fn copy_image_asset(
    library_id: String,
    state: State<'_, PlatformState>,
    document_id: String,
    source_path: String,
) -> Result<String, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    assets::copy_image_asset(workspace, document_id, source_path).map_err(CommandError::from)
}
