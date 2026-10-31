use crate::command_error::CommandError;
use std::path::Path;
use tauri::Manager;
use tauri_notes_workspace::workspace::{
    self, BlockDocumentView, DocumentView, SearchHit, WorkspaceView,
};

fn allow_workspace_assets(app: &tauri::AppHandle, path: &str) {
    let path = Path::new(path);
    let root = if path.is_dir() {
        path
    } else {
        path.parent().unwrap_or(path)
    };
    let _ = app.asset_protocol_scope().allow_directory(root, true);
}

#[tauri::command]
pub fn open_workspace(
    app: tauri::AppHandle,
    path: String,
) -> Result<WorkspaceView, CommandError> {
    let view = workspace::open_workspace(path.clone())?;
    allow_workspace_assets(&app, &path);
    Ok(view)
}

#[tauri::command]
pub async fn create_note_file(
    app: tauri::AppHandle,
    path: String,
    title: String,
) -> Result<WorkspaceView, CommandError> {
    let view = workspace::create_note_file(path.clone(), title).await?;
    allow_workspace_assets(&app, &path);
    Ok(view)
}

#[tauri::command]
pub async fn open_note_workspace(
    app: tauri::AppHandle,
    path: String,
) -> Result<WorkspaceView, CommandError> {
    let view = workspace::open_note_workspace(path.clone()).await?;
    allow_workspace_assets(&app, &path);
    Ok(view)
}

#[tauri::command]
pub async fn save_note_file(path: String) -> Result<String, CommandError> {
    workspace::save_note_file(path).await.map_err(CommandError::from)
}

#[tauri::command]
pub fn read_document(
    workspace: String,
    map_id: String,
    node_id: String,
) -> Result<DocumentView, CommandError> {
    workspace::read_document(workspace, map_id, node_id).map_err(CommandError::from)
}

#[tauri::command]
pub fn document_modified(
    workspace: String,
    map_id: String,
    node_id: String,
) -> Result<u64, CommandError> {
    workspace::document_modified(workspace, map_id, node_id).map_err(CommandError::from)
}

#[tauri::command]
pub fn index_document(
    workspace: String,
    map_id: String,
    node_id: String,
) -> Result<BlockDocumentView, CommandError> {
    workspace::index_document(workspace, map_id, node_id).map_err(CommandError::from)
}

#[tauri::command]
pub fn save_block(
    workspace: String,
    map_id: String,
    node_id: String,
    block_index: usize,
    text: String,
) -> Result<BlockDocumentView, CommandError> {
    workspace::save_block(workspace, map_id, node_id, block_index, text).map_err(CommandError::from)
}

#[tauri::command]
pub fn split_block(
    workspace: String,
    map_id: String,
    node_id: String,
    block_index: usize,
    before: String,
    after: String,
) -> Result<BlockDocumentView, CommandError> {
    workspace::split_block(workspace, map_id, node_id, block_index, before, after).map_err(CommandError::from)
}

#[tauri::command]
pub fn merge_blocks(
    workspace: String,
    map_id: String,
    node_id: String,
    block_index: usize,
    current_text: String,
) -> Result<BlockDocumentView, CommandError> {
    workspace::merge_blocks(workspace, map_id, node_id, block_index, current_text).map_err(CommandError::from)
}

#[tauri::command]
pub fn save_block_range(
    workspace: String,
    map_id: String,
    node_id: String,
    start_index: usize,
    end_index: usize,
    text: String,
) -> Result<BlockDocumentView, CommandError> {
    workspace::save_block_range(
        workspace,
        map_id,
        node_id,
        start_index,
        end_index,
        text,
    )
    .map_err(CommandError::from)
}

#[tauri::command]
pub fn write_document(
    workspace: String,
    map_id: String,
    node_id: String,
    content: String,
) -> Result<BlockDocumentView, CommandError> {
    workspace::write_document(workspace, map_id, node_id, content).map_err(CommandError::from)
}

#[tauri::command]
pub fn delete_blocks(
    workspace: String,
    map_id: String,
    node_id: String,
    block_indices: Vec<usize>,
) -> Result<BlockDocumentView, CommandError> {
    workspace::delete_blocks(workspace, map_id, node_id, block_indices).map_err(CommandError::from)
}

#[tauri::command]
pub fn insert_blocks(
    workspace: String,
    map_id: String,
    node_id: String,
    at_index: usize,
    markdown: String,
) -> Result<BlockDocumentView, CommandError> {
    workspace::insert_blocks(workspace, map_id, node_id, at_index, markdown).map_err(CommandError::from)
}

#[tauri::command]
pub fn search_workspace(
    workspace: String,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchHit>, CommandError> {
    workspace::search_workspace(workspace, query, limit).map_err(CommandError::from)
}

#[tauri::command]
pub async fn search_blocks_db(
    workspace: String,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchHit>, CommandError> {
    workspace::search_blocks_db(workspace, query, limit).await.map_err(CommandError::from)
}
