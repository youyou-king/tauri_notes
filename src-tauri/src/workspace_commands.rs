use tauri_notes_workspace::workspace::{
    self, BlockDocumentView, DocumentView, SearchHit, WorkspaceView,
};

#[tauri::command]
pub fn open_workspace(path: String) -> Result<WorkspaceView, String> {
    workspace::open_workspace(path)
}

#[tauri::command]
pub async fn create_note_file(
    path: String,
    title: String,
) -> Result<WorkspaceView, String> {
    workspace::create_note_file(path, title).await
}

#[tauri::command]
pub async fn open_note_workspace(path: String) -> Result<WorkspaceView, String> {
    workspace::open_note_workspace(path).await
}

#[tauri::command]
pub async fn save_note_file(path: String) -> Result<String, String> {
    workspace::save_note_file(path).await
}

#[tauri::command]
pub fn read_document(
    workspace: String,
    map_id: String,
    node_id: String,
) -> Result<DocumentView, String> {
    workspace::read_document(workspace, map_id, node_id)
}

#[tauri::command]
pub fn document_modified(
    workspace: String,
    map_id: String,
    node_id: String,
) -> Result<u64, String> {
    workspace::document_modified(workspace, map_id, node_id)
}

#[tauri::command]
pub fn index_document(
    workspace: String,
    map_id: String,
    node_id: String,
) -> Result<BlockDocumentView, String> {
    workspace::index_document(workspace, map_id, node_id)
}

#[tauri::command]
pub fn save_block(
    workspace: String,
    map_id: String,
    node_id: String,
    block_index: usize,
    text: String,
) -> Result<BlockDocumentView, String> {
    workspace::save_block(workspace, map_id, node_id, block_index, text)
}

#[tauri::command]
pub fn split_block(
    workspace: String,
    map_id: String,
    node_id: String,
    block_index: usize,
    before: String,
    after: String,
) -> Result<BlockDocumentView, String> {
    workspace::split_block(workspace, map_id, node_id, block_index, before, after)
}

#[tauri::command]
pub fn merge_blocks(
    workspace: String,
    map_id: String,
    node_id: String,
    block_index: usize,
    current_text: String,
) -> Result<BlockDocumentView, String> {
    workspace::merge_blocks(workspace, map_id, node_id, block_index, current_text)
}

#[tauri::command]
pub fn save_block_range(
    workspace: String,
    map_id: String,
    node_id: String,
    start_index: usize,
    end_index: usize,
    text: String,
) -> Result<BlockDocumentView, String> {
    workspace::save_block_range(
        workspace,
        map_id,
        node_id,
        start_index,
        end_index,
        text,
    )
}

#[tauri::command]
pub fn write_document(
    workspace: String,
    map_id: String,
    node_id: String,
    content: String,
) -> Result<BlockDocumentView, String> {
    workspace::write_document(workspace, map_id, node_id, content)
}

#[tauri::command]
pub fn delete_blocks(
    workspace: String,
    map_id: String,
    node_id: String,
    block_indices: Vec<usize>,
) -> Result<BlockDocumentView, String> {
    workspace::delete_blocks(workspace, map_id, node_id, block_indices)
}

#[tauri::command]
pub fn insert_blocks(
    workspace: String,
    map_id: String,
    node_id: String,
    at_index: usize,
    markdown: String,
) -> Result<BlockDocumentView, String> {
    workspace::insert_blocks(workspace, map_id, node_id, at_index, markdown)
}

#[tauri::command]
pub fn search_workspace(
    workspace: String,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchHit>, String> {
    workspace::search_workspace(workspace, query, limit)
}

#[tauri::command]
pub async fn search_blocks_db(
    workspace: String,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchHit>, String> {
    workspace::search_blocks_db(workspace, query, limit).await
}
