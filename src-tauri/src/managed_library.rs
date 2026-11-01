use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri_notes_storage::database;

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

fn unique_target(dir: &Path, source: &Path) -> PathBuf {
    let stem = safe_stem(source);
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

fn summary_for(path: &Path) -> ManagedLibrarySummary {
    let id = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("library")
        .to_string();
    ManagedLibrarySummary {
        title: id.clone(),
        id,
        path: path.to_string_lossy().into_owned(),
    }
}

pub fn list_libraries(data_dir: &Path) -> Result<Vec<ManagedLibrarySummary>, String> {
    let dir = libraries_dir(data_dir);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut libraries = Vec::new();
    for entry in
        fs::read_dir(&dir).map_err(|error| format!("读取移动书库失败：{error}"))?
    {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.is_file()
            && path.extension().and_then(|value| value.to_str()) == Some("note")
        {
            libraries.push(summary_for(&path));
        }
    }
    libraries.sort_by(|left, right| left.id.cmp(&right.id));
    Ok(libraries)
}

/// Copies an external `.note` into the App library after a SQLite checkpoint,
/// so WAL contents are not lost.
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
    fs::create_dir_all(&dir)
        .map_err(|error| format!("创建移动书库失败：{error}"))?;
    if source.starts_with(&dir) {
        return Ok(summary_for(source));
    }

    let source_text = source.to_string_lossy().into_owned();
    database::checkpoint_workspace(&source_text).await?;

    let target = unique_target(&dir, source);
    fs::copy(source, &target).map_err(|error| {
        let _ = fs::remove_file(&target);
        format!("复制到移动书库失败：{error}")
    })?;
    Ok(summary_for(&target))
}

#[cfg(test)]
mod tests {
    use super::{list_libraries, unique_target};
    use std::fs;

    fn temp_root(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "tauri-notes-managed-{name}-{}",
            std::process::id()
        ))
    }

    #[test]
    fn lists_only_note_files() {
        let root = temp_root("list");
        fs::create_dir_all(root.join("libraries")).unwrap();
        fs::write(root.join("libraries/a.note"), "a").unwrap();
        fs::write(root.join("libraries/b.txt"), "b").unwrap();
        let libraries = list_libraries(&root).unwrap();
        assert_eq!(libraries.len(), 1);
        assert_eq!(libraries[0].id, "a");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn creates_collision_free_targets() {
        let root = temp_root("target");
        fs::create_dir_all(&root).unwrap();
        let source = root.join("demo.note");
        fs::write(&source, "x").unwrap();
        let first = unique_target(&root, &source);
        fs::write(&first, "x").unwrap();
        let second = unique_target(&root, &source);
        assert_ne!(first, second);
        fs::remove_dir_all(root).unwrap();
    }
}