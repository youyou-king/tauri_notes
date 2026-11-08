//! 知识库身份命令：登记路径、按 ID 打开、重新定位。
//!
//! 前端只通过 LibraryId 打开知识库；路径仅用于首次登记和重新定位。

use std::path::Path;

use tauri::{AppHandle, State};
use tauri_notes_storage::database;
use tauri_notes_workspace::library::{
    ensure_library_identity, force_library_identity, rename_library_title, LibraryId, LibraryKind,
};
use tauri_notes_workspace::workspace::{self, WorkspaceView};

use crate::command_error::CommandError;
use crate::library_registry::LibraryRegistry;
use crate::platform_state::PlatformState;

fn data_dir(state: &PlatformState) -> Result<std::path::PathBuf, String> {
    state.adapter.data_dir()
}

async fn open_view(path: &str, kind: LibraryKind) -> Result<WorkspaceView, String> {
    match kind {
        LibraryKind::Directory => workspace::open_workspace(path.to_string()),
        LibraryKind::Note => workspace::open_note_workspace(path.to_string()).await,
    }
}

pub async fn register_path(data: &Path, path: &str) -> Result<WorkspaceView, CommandError> {
    let mut identity = ensure_library_identity(Path::new(path), None).await?;
    let (outcome, previous) = LibraryRegistry::update(data, |registry| {
        let previous = registry
            .get(&identity.metadata.id)
            .map(|entry| entry.path.clone());
        let outcome = registry.register(&identity.metadata, Path::new(path))?;
        Ok((outcome, previous))
    })?;
    if let crate::library_registry::RegisterOutcome::CopyConflict { .. } = outcome {
        // 已有路径仍在，说明这是副本；给副本分配新 ID 后再登记。
        identity = force_library_identity(Path::new(path), None).await?;
        LibraryRegistry::update(data, |registry| {
            registry.register(&identity.metadata, Path::new(path))?;
            Ok(())
        })?;
    }
    if let Some(old) = previous {
        if !Path::new(&old).exists() {
            database::close_workspace_pool(&old).await;
        }
    }
    open_view(path, identity.metadata.kind)
        .await
        .map_err(CommandError::from)
}

pub async fn open_path(data: &Path, id: &str) -> Result<WorkspaceView, CommandError> {
    let id = LibraryId::parse(id)?;
    let entry = {
        let registry = LibraryRegistry::load(data)?;
        registry
            .get(&id)
            .cloned()
            .ok_or_else(|| format!("知识库未登记：{id}"))?
    };
    let identity = ensure_library_identity(Path::new(&entry.path), Some(&entry.title)).await?;
    LibraryRegistry::update(data, |registry| {
        registry.register(&identity.metadata, Path::new(&entry.path))?;
        Ok(())
    })?;
    open_view(&entry.path, identity.metadata.kind)
        .await
        .map_err(CommandError::from)
}

pub async fn relocate_path(
    data: &Path,
    id: &str,
    path: &str,
) -> Result<WorkspaceView, CommandError> {
    let id = LibraryId::parse(id)?;
    let identity = ensure_library_identity(Path::new(path), None).await?;
    let previous = LibraryRegistry::update(data, |registry| {
        let previous = registry.get(&id).map(|entry| entry.path.clone());
        registry.relocate(&id, Path::new(path))?;
        registry.register(&identity.metadata, Path::new(path))?;
        Ok(previous)
    })?;
    if let Some(old) = previous {
        if old != path {
            database::close_workspace_pool(&old).await;
        }
    }
    open_view(path, identity.metadata.kind)
        .await
        .map_err(CommandError::from)
}

pub async fn rename_path(
    data: &Path,
    id: &str,
    title: &str,
) -> Result<WorkspaceView, CommandError> {
    let id = LibraryId::parse(id)?;
    let entry = {
        let registry = LibraryRegistry::load(data)?;
        registry
            .get(&id)
            .cloned()
            .ok_or_else(|| format!("知识库未登记：{id}"))?
    };
    let metadata = rename_library_title(Path::new(&entry.path), title).await?;
    LibraryRegistry::update(data, |registry| {
        if !registry.set_title(&id, &metadata.title) {
            return Err(format!("知识库未登记：{id}"));
        }
        Ok(())
    })?;
    open_view(&entry.path, metadata.kind)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn rename_library(
    id: String,
    title: String,
    app: AppHandle,
    state: State<'_, PlatformState>,
) -> Result<WorkspaceView, CommandError> {
    let data = data_dir(&state)?;
    let view = rename_path(&data, &id, &title).await?;
    crate::workspace_commands::allow_workspace_assets(&app, &view.root);
    Ok(view)
}

#[tauri::command]
pub async fn register_library(
    path: String,
    app: AppHandle,
    state: State<'_, PlatformState>,
) -> Result<WorkspaceView, CommandError> {
    let data = data_dir(&state)?;
    let view = register_path(&data, &path).await?;
    crate::workspace_commands::allow_workspace_assets(&app, &view.root);
    Ok(view)
}

#[tauri::command]
pub async fn open_library(
    id: String,
    app: AppHandle,
    state: State<'_, PlatformState>,
) -> Result<WorkspaceView, CommandError> {
    let data = data_dir(&state)?;
    let view = open_path(&data, &id).await?;
    crate::workspace_commands::allow_workspace_assets(&app, &view.root);
    Ok(view)
}

#[tauri::command]
pub async fn relocate_library(
    id: String,
    path: String,
    app: AppHandle,
    state: State<'_, PlatformState>,
) -> Result<WorkspaceView, CommandError> {
    let data = data_dir(&state)?;
    let view = relocate_path(&data, &id, &path).await?;
    crate::workspace_commands::allow_workspace_assets(&app, &view.root);
    Ok(view)
}

#[tauri::command]
pub fn forget_library(id: String, state: State<'_, PlatformState>) -> Result<bool, CommandError> {
    let id = LibraryId::parse(&id)?;
    let data = data_dir(&state)?;
    LibraryRegistry::update(&data, |registry| Ok(registry.remove(&id))).map_err(CommandError::from)
}

#[cfg(test)]
mod tests {
    use super::{open_path, register_path, rename_path};
    use std::fs;
    use std::path::PathBuf;
    use tauri_notes_storage::database;
    use tauri_notes_workspace::workspace;

    fn block_on<F: std::future::Future>(future: F) -> F::Output {
        tauri::async_runtime::block_on(future)
    }

    fn temp_root(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "tauri-notes-library-command-{name}-{}",
            std::process::id()
        ))
    }

    fn remove_dir_with_retry(root: &std::path::Path) {
        for _ in 0..20 {
            match fs::remove_dir_all(root) {
                Ok(()) => return,
                Err(_) => std::thread::sleep(std::time::Duration::from_millis(25)),
            }
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn registers_opens_and_gives_copies_a_new_id() {
        let root = temp_root("copy");
        let data = root.join("data");
        fs::create_dir_all(&root).unwrap();
        let original = root.join("original.note");
        let copy = root.join("copy.note");
        let original_text = original.to_string_lossy().into_owned();

        let created = block_on(workspace::create_note_file(
            original_text.clone(),
            "原始库".to_string(),
        ))
        .unwrap();
        assert!(created.id.as_str().starts_with("lib_"));

        let registered = block_on(register_path(&data, &original_text)).unwrap();
        assert_eq!(registered.id, created.id);
        assert_eq!(registered.title, "原始库");
        assert_eq!(
            crate::library_resolver::resolve_registered_path(&data, registered.id.as_str(),)
                .unwrap(),
            original_text,
        );

        let opened = block_on(open_path(&data, registered.id.as_str())).unwrap();
        assert_eq!(opened.id, registered.id);

        let renamed = block_on(rename_path(&data, registered.id.as_str(), "改名后的库")).unwrap();
        assert_eq!(renamed.title, "改名后的库");
        assert_eq!(
            block_on(open_path(&data, registered.id.as_str()))
                .unwrap()
                .title,
            "改名后的库",
        );

        block_on(database::close_workspace_pool(&original_text));
        fs::copy(&original, &copy).unwrap();
        let copied_text = copy.to_string_lossy().into_owned();
        let copied = block_on(register_path(&data, &copied_text)).unwrap();
        assert_ne!(copied.id, registered.id);

        block_on(database::close_workspace_pool(&copied_text));
        remove_dir_with_retry(&root);
    }

    #[test]
    fn keeps_directory_identity_when_the_library_moves() {
        let root = temp_root("move");
        let data = root.join("data");
        let old = root.join("old.notes");
        let new = root.join("new.notes");
        let map = old.join("map_001");
        fs::create_dir_all(map.join("docs")).unwrap();
        fs::write(
            old.join("meta.json"),
            r#"{"schema_version":1,"title":"目录库","created_at":0}"#,
        )
        .unwrap();
        fs::write(
            old.join("maps.json"),
            r#"{"maps":[{"id":"map_001","title":"目录导图"}]}"#,
        )
        .unwrap();
        fs::write(
            map.join("tree.json"),
            r#"{"root":{"id":"node_001","title":"根","children":[]}}"#,
        )
        .unwrap();

        let old_text = old.to_string_lossy().into_owned();
        let registered = block_on(register_path(&data, &old_text)).unwrap();
        assert!(registered.id.as_str().starts_with("lib_"));

        fs::rename(&old, &new).unwrap();
        let new_text = new.to_string_lossy().into_owned();
        let moved = block_on(register_path(&data, &new_text)).unwrap();
        assert_eq!(moved.id, registered.id);
        assert_eq!(moved.title, "目录库");

        let opened = block_on(open_path(&data, registered.id.as_str())).unwrap();
        assert_eq!(opened.id, registered.id);
        assert_eq!(opened.root, new_text);
        fs::remove_dir_all(root).unwrap();
    }
}
