use crate::command_error::CommandError;
use crate::platform_state::PlatformState;
use tauri::State;
use tauri_notes_document::document_store::{
    self, CreatedDocument, DocumentTreeNode, ImportedDocument, IndexedDbBlock, PreviewBlock,
    SaveBlock, StoredBlock,
};

fn resolve_workspace(
    state: &State<'_, PlatformState>,
    library_id: &str,
) -> Result<String, CommandError> {
    crate::library_resolver::resolve_workspace_path(state.inner(), library_id)
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn list_imported_documents(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
) -> Result<Vec<ImportedDocument>, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    document_store::list_imported_documents(workspace)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn load_document_blocks(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    document_id: String,
) -> Result<Vec<StoredBlock>, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    document_store::load_document_blocks(workspace, document_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn load_blocks_preview(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    block_ids: Vec<String>,
) -> Result<Vec<PreviewBlock>, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    document_store::load_blocks_preview(workspace, block_ids)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn index_blocks_db(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
) -> Result<Vec<IndexedDbBlock>, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    document_store::index_blocks_db(workspace)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn save_imported_blocks(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    document_id: String,
    blocks: Vec<SaveBlock>,
    deleted: Vec<String>,
) -> Result<(), CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    document_store::save_imported_blocks(workspace, document_id, blocks, deleted)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn create_imported_document(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    map_id: String,
    title: String,
) -> Result<CreatedDocument, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    document_store::create_imported_document(workspace, map_id, title)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn get_imported_document_title(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    document_id: String,
) -> Result<String, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    document_store::get_imported_document_title(workspace, document_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn rename_imported_document(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    document_id: String,
    title: String,
) -> Result<(), CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    document_store::rename_imported_document(workspace, document_id, title)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn list_deleted_documents(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
) -> Result<Vec<ImportedDocument>, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    document_store::list_deleted_documents(workspace)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn restore_imported_document(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    document_id: String,
) -> Result<(), CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    document_store::restore_imported_document(workspace, document_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn delete_imported_document(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    document_id: String,
) -> Result<(), CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    document_store::delete_imported_document(workspace, document_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn load_document_tree(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
) -> Result<Vec<DocumentTreeNode>, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    document_store::load_document_tree(workspace)
        .await
        .map_err(CommandError::from)
}
