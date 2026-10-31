use crate::command_error::CommandError;
use tauri_notes_document::document_store::{
    self, CreatedDocument, DocumentTreeNode, ImportedDocument, IndexedDbBlock,
    PreviewBlock, SaveBlock, StoredBlock,
};
use tauri_notes_document::map_store::{
    self, MapNodeView, MindMapView, OutlineView,
};

#[tauri::command]
pub async fn list_imported_documents(
    workspace: String,
) -> Result<Vec<ImportedDocument>, CommandError> {
    document_store::list_imported_documents(workspace).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn load_document_blocks(
    workspace: String,
    document_id: String,
) -> Result<Vec<StoredBlock>, CommandError> {
    document_store::load_document_blocks(workspace, document_id).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn load_blocks_preview(
    workspace: String,
    block_ids: Vec<String>,
) -> Result<Vec<PreviewBlock>, CommandError> {
    document_store::load_blocks_preview(workspace, block_ids).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn index_blocks_db(
    workspace: String,
) -> Result<Vec<IndexedDbBlock>, CommandError> {
    document_store::index_blocks_db(workspace).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn save_imported_blocks(
    workspace: String,
    document_id: String,
    blocks: Vec<SaveBlock>,
    deleted: Vec<String>,
) -> Result<(), CommandError> {
    document_store::save_imported_blocks(workspace, document_id, blocks, deleted).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn create_imported_document(
    workspace: String,
    map_id: String,
    title: String,
) -> Result<CreatedDocument, CommandError> {
    document_store::create_imported_document(workspace, map_id, title).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn get_imported_document_title(
    workspace: String,
    document_id: String,
) -> Result<String, CommandError> {
    document_store::get_imported_document_title(workspace, document_id).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn rename_imported_document(
    workspace: String,
    document_id: String,
    title: String,
) -> Result<(), CommandError> {
    document_store::rename_imported_document(workspace, document_id, title).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn list_deleted_documents(
    workspace: String,
) -> Result<Vec<ImportedDocument>, CommandError> {
    document_store::list_deleted_documents(workspace).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn restore_imported_document(
    workspace: String,
    document_id: String,
) -> Result<(), CommandError> {
    document_store::restore_imported_document(workspace, document_id).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn delete_imported_document(
    workspace: String,
    document_id: String,
) -> Result<(), CommandError> {
    document_store::delete_imported_document(workspace, document_id).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn load_document_tree(
    workspace: String,
) -> Result<Vec<DocumentTreeNode>, CommandError> {
    document_store::load_document_tree(workspace).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn load_mind_map(
    workspace: String,
    map_id: String,
) -> Result<MindMapView, CommandError> {
    map_store::load_mind_map(workspace, map_id).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn load_outline(workspace: String) -> Result<OutlineView, CommandError> {
    map_store::load_outline(workspace).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn create_mind_map(workspace: String, title: String) -> Result<String, CommandError> {
    map_store::create_mind_map(workspace, title).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn rename_mind_map(
    workspace: String,
    map_id: String,
    title: String,
) -> Result<(), CommandError> {
    map_store::rename_mind_map(workspace, map_id, title).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn delete_mind_map(workspace: String, map_id: String) -> Result<(), CommandError> {
    map_store::delete_mind_map(workspace, map_id).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn delete_map_node(workspace: String, node_id: String) -> Result<(), CommandError> {
    map_store::delete_map_node(workspace, node_id).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn create_map_node(
    workspace: String,
    map_id: String,
    parent_id: Option<String>,
    title: String,
) -> Result<String, CommandError> {
    map_store::create_map_node(workspace, map_id, parent_id, title).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn rename_map_node(
    workspace: String,
    node_id: String,
    title: String,
) -> Result<(), CommandError> {
    map_store::rename_map_node(workspace, node_id, title).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn set_map_node_position(
    workspace: String,
    node_id: String,
    x: f64,
    y: f64,
) -> Result<(), CommandError> {
    map_store::set_map_node_position(workspace, node_id, x, y).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn create_document_for_map_root(
    workspace: String,
    map_id: String,
) -> Result<String, CommandError> {
    map_store::create_document_for_map_root(workspace, map_id).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn create_document_for_map_node(
    workspace: String,
    node_id: String,
) -> Result<MapNodeView, CommandError> {
    map_store::create_document_for_map_node(workspace, node_id).await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn bind_document_to_map_node(
    workspace: String,
    node_id: String,
    document_id: String,
) -> Result<(), CommandError> {
    map_store::bind_document_to_map_node(workspace, node_id, document_id).await.map_err(CommandError::from)
}
