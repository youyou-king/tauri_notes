use crate::command_error::CommandError;
use crate::library_resolver;
use crate::platform_state::PlatformState;
use tauri::State;
use tauri_notes_document::map_store::{self, MapNodeView, MindMapView, OutlineView};

fn resolve_workspace(
    state: &State<'_, PlatformState>,
    library_id: &str,
) -> Result<String, CommandError> {
    library_resolver::resolve_workspace_path(state.inner(), library_id).map_err(CommandError::from)
}

#[tauri::command]
pub async fn load_mind_map(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    map_id: String,
) -> Result<MindMapView, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    map_store::load_mind_map(workspace, map_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn load_outline(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
) -> Result<OutlineView, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    map_store::load_outline(workspace)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn create_mind_map(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    title: String,
) -> Result<String, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    map_store::create_mind_map(workspace, title)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn rename_mind_map(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    map_id: String,
    title: String,
) -> Result<(), CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    map_store::rename_mind_map(workspace, map_id, title)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn delete_mind_map(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    map_id: String,
) -> Result<(), CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    map_store::delete_mind_map(workspace, map_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn delete_map_node(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    node_id: String,
) -> Result<(), CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    map_store::delete_map_node(workspace, node_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn create_map_node(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    map_id: String,
    parent_id: Option<String>,
    title: String,
) -> Result<String, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    map_store::create_map_node(workspace, map_id, parent_id, title)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn rename_map_node(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    node_id: String,
    title: String,
) -> Result<(), CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    map_store::rename_map_node(workspace, node_id, title)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn set_map_node_positions(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    positions: Vec<map_store::MapNodePosition>,
) -> Result<(), CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    map_store::set_map_node_positions(workspace, positions)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn create_document_for_map_root(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    map_id: String,
) -> Result<String, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    map_store::create_document_for_map_root(workspace, map_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn create_document_for_map_node(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    node_id: String,
) -> Result<MapNodeView, CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    map_store::create_document_for_map_node(workspace, node_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn bind_document_to_map_node(
    library_id: String,
    state: tauri::State<'_, PlatformState>,
    node_id: String,
    document_id: String,
) -> Result<(), CommandError> {
    let workspace = resolve_workspace(&state, &library_id)?;
    map_store::bind_document_to_map_node(workspace, node_id, document_id)
        .await
        .map_err(CommandError::from)
}
