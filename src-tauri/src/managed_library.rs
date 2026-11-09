use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri_notes_workspace::library::{ensure_library_identity, LibraryId, LibraryIdentity};

use crate::library_registry::{normalize_path, LibraryRegistry};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedLibrarySummary {
    pub id: String,
    pub title: String,
    pub path: String,
}

fn libraries_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("libraries")
}

fn safe_stem(source: &Path) -> String {
    let stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("library");
    let cleaned: String = stem
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect();
    if cleaned.is_empty() {
        "library".to_string()
    } else {
        cleaned
    }
}

fn unique_target(dir: &Path, stem: &str) -> PathBuf {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let mut candidate = dir.join(format!("{stem}-{stamp}.note"));
    let mut suffix = 1u32;
    while candidate.exists() {
        candidate = dir.join(format!("{stem}-{stamp}-{suffix}.note"));
        suffix += 1;
    }
    candidate
}

fn safe_title(title: &str) -> String {
    let cleaned: String = title
        .trim()
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect();
    let cleaned = cleaned.trim_matches('-').to_string();
    if cleaned.is_empty() {
        "未命名".to_string()
    } else {
        cleaned
    }
}

pub fn new_library_path(title: &str, data_dir: &Path) -> Result<PathBuf, String> {
    let dir = libraries_dir(data_dir);
    fs::create_dir_all(&dir).map_err(|error| format!("创建移动知识库失败：{error}"))?;
    Ok(unique_target(&dir, &safe_title(title)))
}

/// Deletes a library only when it lives inside the app-private library
/// directory, then removes its registry entry and SQLite sidecars.
pub fn delete_library(path: &Path, data_dir: &Path) -> Result<(), String> {
    let dir = normalize_path(&libraries_dir(data_dir))?;
    let target = normalize_path(path)?;
    let target_path = Path::new(&target);
    if target_path == Path::new(&dir) || !target_path.starts_with(Path::new(&dir)) {
        return Err("只能删除移动端托管知识库".to_string());
    }
    if target_path.extension().and_then(|value| value.to_str()) != Some("note") {
        return Err("只能删除 .note 知识库".to_string());
    }
    if !target_path.is_file() {
        return Err(format!("知识库不存在：{}", target_path.display()));
    }

    LibraryRegistry::update(data_dir, |registry| {
        if let Some((id, _)) = registry.find_by_path(target_path) {
            registry.remove(&LibraryId::parse(id)?);
        }
        Ok(())
    })?;

    fs::remove_file(target_path)
        .map_err(|error| format!("删除知识库失败：{error}"))?;
    for suffix in ["-wal", "-shm"] {
        let sidecar = target_path.with_file_name(format!(
            "{}{suffix}",
            target_path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
        ));
        if sidecar.exists() {
            let _ = fs::remove_file(sidecar);
        }
    }
    Ok(())
}

async fn summary_for(data_dir: &Path, path: &Path) -> Result<ManagedLibrarySummary, String> {
    let identity: LibraryIdentity = ensure_library_identity(path, None).await?;
    LibraryRegistry::update(data_dir, |registry| {
        registry.register(&identity.metadata, path)?;
        Ok(())
    })?;
    Ok(ManagedLibrarySummary {
        id: identity.metadata.id.to_string(),
        title: identity.metadata.title,
        path: path.to_string_lossy().into_owned(),
    })
}

/// Android's save dialog returns a `content://` URI; copy through the
/// platform content resolver via the fs plugin instead of treating it as a
/// filesystem path.
#[cfg(mobile)]
pub async fn export_library_uri(
    app: &tauri::AppHandle,
    source: &str,
    destination: &str,
) -> Result<String, String> {
    use tauri_plugin_fs::{FilePath, FsExt, OpenOptions};

    let source = Path::new(source);
    if !source.is_file() {
        return Err(format!("不是 .note 文件：{}", source.display()));
    }

    let url =
        url::Url::parse(destination).map_err(|error| format!("导出目标 URI 无效：{error}"))?;
    let mut options = OpenOptions::new();
    options.write(true).create(true).truncate(true);
    let mut target = app
        .fs()
        .open(FilePath::Url(url), options)
        .map_err(|error| format!("打开导出目标失败：{error}"))?;
    let mut input = fs::File::open(source).map_err(|error| format!("读取知识库失败：{error}"))?;
    std::io::copy(&mut input, &mut target).map_err(|error| format!("写入导出文件失败：{error}"))?;
    Ok(destination.to_string())
}

/// Copies a managed library to an explicit destination. The caller owns
/// destination confirmation.
pub async fn export_library(source: &Path, destination: &Path) -> Result<String, String> {
    if !source.is_file() {
        return Err(format!("不是 .note 文件：{}", source.display()));
    }
    if destination.extension().and_then(|value| value.to_str()) != Some("note") {
        return Err("导出目标必须是 .note 文件".to_string());
    }
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建导出目录失败：{error}"))?;
    }
    fs::copy(source, destination).map_err(|error| format!("导出知识库失败：{error}"))?;
    Ok(destination.to_string_lossy().into_owned())
}

/// Android's file picker returns a `content://` URI; copy through the
/// platform content resolver instead of treating it as a filesystem path.
#[cfg(mobile)]
pub async fn import_library_uri(
    app: &tauri::AppHandle,
    source_uri: &str,
    data_dir: &Path,
) -> Result<ManagedLibrarySummary, String> {
    use tauri_plugin_fs::{FilePath, FsExt, OpenOptions};

    let url = url::Url::parse(source_uri).map_err(|error| format!("导入源 URI 无效：{error}"))?;
    let dir = libraries_dir(data_dir);
    fs::create_dir_all(&dir).map_err(|error| format!("创建移动知识库失败：{error}"))?;
    let target = unique_target(&dir, "imported");
    let mut options = OpenOptions::new();
    options.read(true);
    let mut input = app
        .fs()
        .open(FilePath::Url(url), options)
        .map_err(|error| format!("读取导入文件失败：{error}"))?;
    let mut output =
        fs::File::create(&target).map_err(|error| format!("创建导入文件失败：{error}"))?;
    std::io::copy(&mut input, &mut output).map_err(|error| {
        let _ = fs::remove_file(&target);
        format!("导入文件失败：{error}")
    })?;
    Ok(summary_for(data_dir, &target).await?)
}

pub fn list_libraries(data_dir: &Path) -> Result<Vec<ManagedLibrarySummary>, String> {
    let dir = normalize_path(&libraries_dir(data_dir))?;
    let registry = LibraryRegistry::load(data_dir)?;
    let mut libraries: Vec<ManagedLibrarySummary> = registry
        .entries()
        .filter(|(_, entry)| Path::new(&entry.path).starts_with(&dir))
        .map(|(_, entry)| ManagedLibrarySummary {
            id: entry.id.to_string(),
            title: entry.title.clone(),
            path: entry.path.clone(),
        })
        .collect();
    libraries.sort_by(|left, right| left.title.cmp(&right.title));
    Ok(libraries)
}

/// Copies an external `.note` into the App library.
pub async fn import_library(
    source: &Path,
    data_dir: &Path,
) -> Result<ManagedLibrarySummary, String> {
    if !source.is_file() {
        return Err(format!("不是 .note 文件：{}", source.display()));
    }
    if source.extension().and_then(|value| value.to_str()) != Some("note") {
        return Err("只能导入 .note 文件".to_string());
    }
    let dir = libraries_dir(data_dir);
    fs::create_dir_all(&dir).map_err(|error| format!("创建移动知识库失败：{error}"))?;
    if source.starts_with(&dir) {
        return summary_for(data_dir, source).await;
    }

    let target = unique_target(&dir, &safe_stem(source));
    fs::copy(source, &target).map_err(|error| {
        let _ = fs::remove_file(&target);
        format!("复制到移动知识库失败：{error}")
    })?;
    summary_for(data_dir, &target).await
}

#[cfg(test)]
mod tests {
    use super::{list_libraries, unique_target};
    use crate::library_registry::LibraryRegistry;
    use std::fs;
    use tauri_notes_workspace::library::{LibraryId, LibraryKind, LibraryMetadata};

    fn temp_root(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!("tauri-notes-managed-{name}-{}", std::process::id()))
    }

    #[test]
    fn lists_registered_note_files() {
        let root = temp_root("list");
        fs::create_dir_all(root.join("libraries")).unwrap();
        let note = root.join("libraries/a.note");
        fs::write(&note, b"").unwrap();
        fs::write(root.join("libraries/b.txt"), "b").unwrap();
        LibraryRegistry::update(&root, |registry| {
            registry.register(
                &LibraryMetadata {
                    id: LibraryId::parse("lib_a").unwrap(),
                    title: "A".to_string(),
                    kind: LibraryKind::Note,
                },
                &note,
            )?;
            Ok(())
        })
        .unwrap();
        let libraries = list_libraries(&root).unwrap();
        assert_eq!(libraries.len(), 1);
        assert_eq!(libraries[0].id, "lib_a");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn creates_collision_free_targets() {
        let root = temp_root("target");
        fs::create_dir_all(&root).unwrap();
        let source = root.join("demo.note");
        fs::write(&source, "x").unwrap();
        let first = unique_target(&root, "demo");
        fs::write(&first, "x").unwrap();
        let second = unique_target(&root, "demo");
        assert_ne!(first, second);
        fs::remove_dir_all(root).unwrap();
    }
}
