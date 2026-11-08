//! 知识库身份到文件位置的解析边界。
//!
//! 只有这里负责把 `LibraryId` 变成当前 `LibraryPath`；文件服务拿到路径后
//! 不再反向依赖 registry。

use std::path::Path;

use tauri_notes_workspace::library::LibraryId;

use crate::library_registry::LibraryRegistry;
use crate::platform_state::PlatformState;

/// Resolve a registered library id against an explicit data directory.
pub fn resolve_registered_path(data: &Path, id: &str) -> Result<String, String> {
    let id = LibraryId::parse(id)?;
    let registry = LibraryRegistry::load(data)?;
    registry
        .get(&id)
        .map(|entry| entry.path.clone())
        .ok_or_else(|| format!("知识库未登记：{id}"))
}

/// Resolve a library id using the platform's application data directory.
pub fn resolve_workspace_path(state: &PlatformState, id: &str) -> Result<String, String> {
    let data = state.adapter.data_dir()?;
    resolve_registered_path(&data, id)
}
