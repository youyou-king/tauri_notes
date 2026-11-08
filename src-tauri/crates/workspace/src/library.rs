//! 书库身份：稳定 ID 与书库内 metadata。
//!
//! 路径只是书库的位置；`LibraryId` 跟着文件走。`.notes` 目录把 ID 存在
//! `meta.json`，`.note` SQLite 把 ID 存在 `library_meta` 表。

use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};

use crate::access::{ensure_directory_writable, ensure_note_writable};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri_notes_platform::replace_file;
use tauri_notes_storage::database;
use uuid::Uuid;

const ID_PREFIX: &str = "lib_";
const MAX_ID_LEN: usize = 128;

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct LibraryId(String);

impl LibraryId {
    pub fn generate() -> Self {
        Self(format!("{ID_PREFIX}{}", Uuid::new_v4().simple()))
    }

    /// 接受字母、数字、`_`、`-`，避免把路径分隔符带进 ID。
    pub fn parse(value: &str) -> Result<Self, String> {
        let trimmed = value.trim();
        if trimmed.is_empty() || trimmed.len() > MAX_ID_LEN {
            return Err("书库 ID 为空或过长".to_string());
        }
        if !trimmed.starts_with(ID_PREFIX) || trimmed.len() == ID_PREFIX.len() {
            return Err(format!("书库 ID 必须以 {ID_PREFIX} 开头"));
        }
        if !trimmed
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
        {
            return Err(format!("书库 ID 含非法字符：{trimmed}"));
        }
        Ok(Self(trimmed.to_string()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for LibraryId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LibraryKind {
    Directory,
    Note,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryMetadata {
    pub id: LibraryId,
    pub title: String,
    pub kind: LibraryKind,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LibraryIdentity {
    pub metadata: LibraryMetadata,
}

/// 确保书库有 ID；缺失时生成并写回元数据，已有 ID 时原样保留。
pub async fn ensure_library_identity(
    path: &Path,
    fallback_title: Option<&str>,
) -> Result<LibraryIdentity, String> {
    if is_note_file(path) {
        return ensure_note_identity(path, fallback_title).await;
    }
    if path.is_dir() {
        return ensure_directory_identity(path, fallback_title);
    }
    Err(format!("不是书库路径：{}", path.display()))
}

/// 给副本写入一个全新的 ID；调用方已确认这是复制而不是移动。
pub async fn force_library_identity(
    path: &Path,
    fallback_title: Option<&str>,
) -> Result<LibraryIdentity, String> {
    if is_note_file(path) {
        ensure_note_writable(path)
            .await
            .map_err(|error| error.to_string())?;
        let path_text = path.to_string_lossy().into_owned();
        let existing = database::read_library_metadata(&path_text).await?;
        let title = fallback_title
            .map(str::to_string)
            .or_else(|| existing.map(|metadata| metadata.title))
            .or_else(|| {
                path.file_stem()
                    .and_then(|value| value.to_str())
                    .map(str::to_string)
            })
            .unwrap_or_else(|| "知识库".to_string());
        let id = LibraryId::generate();
        let stored = database::replace_library_metadata(&path_text, id.as_str(), &title).await?;
        return Ok(LibraryIdentity {
            metadata: LibraryMetadata {
                id: LibraryId::parse(&stored.id)?,
                title: stored.title,
                kind: LibraryKind::Note,
            },
        });
    }

    if !path.is_dir() {
        return Err(format!("不是书库路径：{}", path.display()));
    }
    ensure_directory_writable(path).map_err(|error| error.to_string())?;
    let meta_path = path.join("meta.json");
    let text = fs::read_to_string(&meta_path)
        .map_err(|error| format!("读取 {} 失败：{error}", meta_path.display()))?;
    let mut value: Value = serde_json::from_str(&text)
        .map_err(|error| format!("解析 {} 失败：{error}", meta_path.display()))?;
    let title = value
        .get("title")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| fallback_title.map(str::to_string))
        .unwrap_or_else(|| "知识库".to_string());
    let id = LibraryId::generate();
    value["id"] = Value::String(id.as_str().to_string());
    let mut text = serde_json::to_string_pretty(&value)
        .map_err(|error| format!("序列化 {} 失败：{error}", meta_path.display()))?;
    text.push('\n');
    write_atomic(&meta_path, &text)?;
    Ok(LibraryIdentity {
        metadata: LibraryMetadata {
            id,
            title,
            kind: LibraryKind::Directory,
        },
    })
}

fn is_note_file(path: &Path) -> bool {
    path.is_file()
        && path
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|value| value.eq_ignore_ascii_case("note"))
}

pub fn ensure_directory_identity(
    path: &Path,
    fallback_title: Option<&str>,
) -> Result<LibraryIdentity, String> {
    ensure_directory_writable(path).map_err(|error| error.to_string())?;
    let meta_path = path.join("meta.json");
    let text = fs::read_to_string(&meta_path)
        .map_err(|error| format!("读取 {} 失败：{error}", meta_path.display()))?;
    let mut value: Value = serde_json::from_str(&text)
        .map_err(|error| format!("解析 {} 失败：{error}", meta_path.display()))?;
    let title = value
        .get("title")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| fallback_title.map(str::to_string))
        .or_else(|| {
            path.file_name()
                .and_then(|value| value.to_str())
                .map(str::to_string)
        })
        .unwrap_or_else(|| "知识库".to_string());

    let existing = match value.get("id") {
        Some(Value::String(id)) => Some(LibraryId::parse(id)?),
        Some(_) => return Err("meta.json 的 id 不是字符串".to_string()),
        None => None,
    };
    let id = existing.clone().unwrap_or_else(LibraryId::generate);
    let metadata = LibraryMetadata {
        id: id.clone(),
        title,
        kind: LibraryKind::Directory,
    };

    if existing.is_some() {
        return Ok(LibraryIdentity { metadata });
    }

    value["id"] = Value::String(id.as_str().to_string());
    let mut text = serde_json::to_string_pretty(&value)
        .map_err(|error| format!("序列化 {} 失败：{error}", meta_path.display()))?;
    text.push('\n');
    write_atomic(&meta_path, &text)?;
    Ok(LibraryIdentity { metadata })
}

async fn ensure_note_identity(
    path: &Path,
    fallback_title: Option<&str>,
) -> Result<LibraryIdentity, String> {
    ensure_note_writable(path)
        .await
        .map_err(|error| error.to_string())?;
    let title = fallback_title
        .map(str::to_string)
        .or_else(|| {
            path.file_stem()
                .and_then(|value| value.to_str())
                .map(str::to_string)
        })
        .unwrap_or_else(|| "知识库".to_string());
    let generated = LibraryId::generate();
    let path_text = path.to_string_lossy().into_owned();
    let stored = database::ensure_library_metadata(&path_text, generated.as_str(), &title).await?;
    let id = LibraryId::parse(&stored.id)?;
    Ok(LibraryIdentity {
        metadata: LibraryMetadata {
            id,
            title: stored.title,
            kind: LibraryKind::Note,
        },
    })
}

pub fn rename_directory_title(path: &Path, title: &str) -> Result<LibraryMetadata, String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("书库标题不能为空".to_string());
    }
    let identity = ensure_directory_identity(path, None)?;
    let meta_path = path.join("meta.json");
    let text = fs::read_to_string(&meta_path)
        .map_err(|error| format!("读取 {} 失败：{error}", meta_path.display()))?;
    let mut value: Value = serde_json::from_str(&text)
        .map_err(|error| format!("解析 {} 失败：{error}", meta_path.display()))?;
    value["id"] = Value::String(identity.metadata.id.as_str().to_string());
    value["title"] = Value::String(title.to_string());
    let mut next = serde_json::to_string_pretty(&value)
        .map_err(|error| format!("序列化 {} 失败：{error}", meta_path.display()))?;
    next.push('\n');
    write_atomic(&meta_path, &next)?;
    Ok(LibraryMetadata {
        id: identity.metadata.id,
        title: title.to_string(),
        kind: LibraryKind::Directory,
    })
}

pub async fn rename_note_title(path: &Path, title: &str) -> Result<LibraryMetadata, String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("书库标题不能为空".to_string());
    }
    let identity = ensure_note_identity(path, None).await?;
    let path_text = path.to_string_lossy().into_owned();
    database::replace_library_metadata(&path_text, identity.metadata.id.as_str(), title).await?;
    Ok(LibraryMetadata {
        id: identity.metadata.id,
        title: title.to_string(),
        kind: LibraryKind::Note,
    })
}

pub async fn rename_library_title(path: &Path, title: &str) -> Result<LibraryMetadata, String> {
    if is_note_file(path) {
        rename_note_title(path, title).await
    } else {
        rename_directory_title(path, title)
    }
}

fn write_atomic(target: &Path, text: &str) -> Result<(), String> {
    let temp = sibling_temp(target);
    fs::write(&temp, text).map_err(|error| format!("写入 {} 失败：{error}", temp.display()))?;
    replace_file(&temp, target).inspect_err(|_| {
        let _ = fs::remove_file(&temp);
    })
}

fn sibling_temp(target: &Path) -> PathBuf {
    let name = target
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("meta.json");
    target.with_file_name(format!(".{name}.tmp"))
}

#[cfg(test)]
mod tests {
    use super::{
        ensure_directory_identity, ensure_library_identity, force_library_identity,
        rename_directory_title, rename_note_title, LibraryKind,
    };
    use crate::access::ensure_note_writable;
    use std::fs;
    use std::path::PathBuf;
    use tauri_notes_storage::database;

    fn workspace(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("tauri-notes-library-{name}-{}", std::process::id()))
    }

    fn block_on<F: std::future::Future>(future: F) -> F::Output {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("runtime")
            .block_on(future)
    }

    #[test]
    fn writes_id_once_for_directory_library() {
        let root = workspace("directory");
        fs::create_dir_all(&root).unwrap();
        fs::write(
            root.join("meta.json"),
            r#"{"schema_version":1,"title":"目录书库"}"#,
        )
        .unwrap();

        let first = ensure_directory_identity(&root, None).unwrap();
        assert_eq!(first.metadata.kind, LibraryKind::Directory);
        assert_eq!(first.metadata.title, "目录书库");
        assert!(first.metadata.id.as_str().starts_with("lib_"));

        let second = ensure_directory_identity(&root, None).unwrap();
        assert_eq!(second.metadata.id, first.metadata.id);

        let renamed = rename_directory_title(&root, "新目录名").unwrap();
        assert_eq!(renamed.id, first.metadata.id);
        assert_eq!(renamed.title, "新目录名");
        assert_eq!(
            ensure_directory_identity(&root, None)
                .unwrap()
                .metadata
                .title,
            "新目录名",
        );

        let text = fs::read_to_string(root.join("meta.json")).unwrap();
        assert!(text.contains(first.metadata.id.as_str()));
        assert!(text.contains("\"schema_version\": 1"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn initializes_missing_directory_id() {
        let root = workspace("directory-id-init");
        fs::create_dir_all(&root).unwrap();
        fs::write(
            root.join("meta.json"),
            r#"{"schema_version":1,"title":"测试库"}"#,
        )
        .unwrap();
        let identity = ensure_directory_identity(&root, None).unwrap();
        assert!(identity.metadata.id.as_str().starts_with("lib_"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_ids_without_the_library_prefix() {
        assert!(super::LibraryId::parse("demo").is_err());
        assert!(super::LibraryId::parse("lib_").is_err());
        assert!(super::LibraryId::parse("lib_a").is_ok());
    }

    #[test]
    #[allow(clippy::permissions_set_readonly_false)] // 测试结束后必须恢复可写才能清理临时目录。
    fn rejects_read_only_directory() {
        let root = workspace("readonly-directory");
        fs::create_dir_all(&root).unwrap();
        let meta = root.join("meta.json");
        fs::write(&meta, r#"{"schema_version":1,"title":"只读目录"}"#).unwrap();
        let mut permissions = fs::metadata(&meta).unwrap().permissions();
        permissions.set_readonly(true);
        fs::set_permissions(&meta, permissions).unwrap();

        let error = ensure_directory_identity(&root, None).unwrap_err();
        assert!(error.contains("只读"), "{error}");

        let mut permissions = fs::metadata(&meta).unwrap().permissions();
        permissions.set_readonly(false);
        fs::set_permissions(&meta, permissions).unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(windows)]
    #[test]
    #[allow(clippy::permissions_set_readonly_false)] // 测试结束后必须恢复可写才能清理临时目录。
    fn accepts_note_in_directory_with_readonly_attribute() {
        let root = workspace("readonly-attribute");
        fs::create_dir_all(&root).unwrap();
        let path = root.join("desktop.note");
        fs::write(&path, b"").unwrap();
        let mut permissions = fs::metadata(&root).unwrap().permissions();
        permissions.set_readonly(true);
        fs::set_permissions(&root, permissions).unwrap();

        assert!(block_on(ensure_note_writable(&path)).is_ok());

        let mut permissions = fs::metadata(&root).unwrap().permissions();
        permissions.set_readonly(false);
        fs::set_permissions(&root, permissions).unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    #[allow(clippy::permissions_set_readonly_false)] // 测试结束后必须恢复可写才能清理临时目录。
    fn rejects_read_only_note() {
        let root = workspace("readonly");
        fs::create_dir_all(&root).unwrap();
        let path = root.join("readonly.note");
        fs::write(&path, b"").unwrap();
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(true);
        fs::set_permissions(&path, permissions).unwrap();

        let error = block_on(ensure_library_identity(&path, Some("只读"))).unwrap_err();
        assert!(error.contains("只读"), "{error}");

        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(false);
        fs::set_permissions(&path, permissions).unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn note_identity_round_trips_through_sqlite() {
        let root = workspace("note");
        fs::create_dir_all(&root).unwrap();
        let path = root.join("demo.note");
        fs::write(&path, b"").unwrap(); // ensure_library_metadata initializes it.

        let first = block_on(ensure_library_identity(&path, Some("演示库"))).unwrap();
        assert_eq!(first.metadata.kind, LibraryKind::Note);
        assert_eq!(first.metadata.title, "演示库");

        let second = block_on(ensure_library_identity(&path, Some("另一个标题"))).unwrap();
        assert_eq!(second.metadata.id, first.metadata.id);
        assert_eq!(second.metadata.title, "演示库");

        let renamed = block_on(rename_note_title(&path, "改名后的库")).unwrap();
        assert_eq!(renamed.id, first.metadata.id);
        assert_eq!(renamed.title, "改名后的库");
        assert_eq!(
            block_on(ensure_library_identity(&path, None))
                .unwrap()
                .metadata
                .title,
            "改名后的库",
        );
        let path_text = path.to_string_lossy().into_owned();
        block_on(database::close_workspace_pool(&path_text));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn force_assigns_a_new_id_to_a_copy() {
        let root = workspace("copy");
        fs::create_dir_all(&root).unwrap();
        let path = root.join("copy.note");
        fs::write(&path, b"").unwrap();
        let first = block_on(ensure_library_identity(&path, Some("原库"))).unwrap();
        let copied = block_on(force_library_identity(&path, Some("副本"))).unwrap();
        assert_ne!(copied.metadata.id, first.metadata.id);
        assert_eq!(copied.metadata.title, "副本");
        let path_text = path.to_string_lossy().into_owned();
        block_on(database::close_workspace_pool(&path_text));
        fs::remove_dir_all(root).unwrap();
    }
}
