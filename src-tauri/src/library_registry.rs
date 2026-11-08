//! 知识库注册表：把稳定 ID 映射到路径和标题。
//!
//! registry 是索引，不是身份真相；知识库文件里的 metadata 才是 ID 来源。
//! 文件丢失后可以重新打开路径重建，registry 损坏也不影响知识库本身。

use std::collections::BTreeMap;
use std::env;
use std::fs::{self, OpenOptions};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::thread::sleep;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri_notes_platform::replace_file;
use tauri_notes_workspace::library::{LibraryId, LibraryMetadata};

const REGISTRY_FILE: &str = "libraries.json";
const REGISTRY_VERSION: u32 = 3;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryEntry {
    pub id: LibraryId,
    pub path: String,
    pub title: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RegisterOutcome {
    Created,
    Existing,
    Moved,
    CopyConflict { existing_path: String },
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct RegistryFile {
    version: u32,
    libraries: BTreeMap<String, RegistryEntry>,
}

pub struct LibraryRegistry {
    path: PathBuf,
    data: RegistryFile,
}

/// 跨进程写锁：`libraries.json.lock` 存在期间独占 registry。
struct RegistryLock {
    path: PathBuf,
}

impl RegistryLock {
    fn acquire(data_dir: &Path) -> Result<Self, String> {
        fs::create_dir_all(data_dir).map_err(|error| format!("创建注册表目录失败：{error}"))?;
        let path = data_dir.join(".libraries.json.lock");
        for _ in 0..100 {
            match OpenOptions::new().write(true).create_new(true).open(&path) {
                Ok(_) => return Ok(Self { path }),
                Err(error) if error.kind() == ErrorKind::AlreadyExists => {
                    let stale = fs::metadata(&path)
                        .and_then(|metadata| metadata.modified())
                        .ok()
                        .and_then(|time| time.elapsed().ok())
                        .is_some_and(|elapsed| elapsed > Duration::from_secs(10));
                    if stale {
                        let _ = fs::remove_file(&path);
                        continue;
                    }
                    sleep(Duration::from_millis(20));
                }
                Err(error) => {
                    return Err(format!("获取知识库注册表锁失败：{error}"));
                }
            }
        }
        Err("知识库注册表被其他进程占用".to_string())
    }
}

impl Drop for RegistryLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

impl LibraryRegistry {
    pub fn load(data_dir: &Path) -> Result<Self, String> {
        let path = data_dir.join(REGISTRY_FILE);
        let empty = || Self {
            path: data_dir.join(REGISTRY_FILE),
            data: RegistryFile {
                version: REGISTRY_VERSION,
                libraries: BTreeMap::new(),
            },
        };
        if !path.exists() {
            return Ok(empty());
        }
        let text =
            fs::read_to_string(&path).map_err(|error| format!("读取知识库注册表失败：{error}"))?;
        let data: RegistryFile = serde_json::from_str(&text)
            .map_err(|error| format!("解析知识库注册表失败：{error}"))?;
        if data.version != REGISTRY_VERSION {
            return Err(format!(
                "知识库注册表版本不匹配：{}（当前要求 {}）",
                data.version, REGISTRY_VERSION
            ));
        }
        Ok(Self { path, data })
    }

    #[cfg(test)]
    pub fn save(&self) -> Result<(), String> {
        let parent = self
            .path
            .parent()
            .ok_or_else(|| "注册表路径缺少父目录".to_string())?;
        let _lock = RegistryLock::acquire(parent)?;
        self.save_unlocked()
    }

    fn save_unlocked(&self) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|error| format!("创建注册表目录失败：{error}"))?;
        }
        let mut text = serde_json::to_string_pretty(&self.data)
            .map_err(|error| format!("序列化知识库注册表失败：{error}"))?;
        text.push('\n');
        let temp = self.path.with_file_name(format!(".{REGISTRY_FILE}.tmp"));
        fs::write(&temp, text).map_err(|error| format!("写入知识库注册表失败：{error}"))?;
        replace_file(&temp, &self.path).inspect_err(|_| {
            let _ = fs::remove_file(&temp);
        })
    }

    /// 在跨进程锁内完成一次 load → mutate → save。
    pub fn update<T>(
        data_dir: &Path,
        mutate: impl FnOnce(&mut Self) -> Result<T, String>,
    ) -> Result<T, String> {
        let _lock = RegistryLock::acquire(data_dir)?;
        let mut registry = Self::load(data_dir)?;
        let result = mutate(&mut registry)?;
        registry.save_unlocked()?;
        Ok(result)
    }

    pub fn get(&self, id: &LibraryId) -> Option<&RegistryEntry> {
        self.data.libraries.get(id.as_str())
    }

    pub fn entries(&self) -> impl Iterator<Item = (&str, &RegistryEntry)> {
        self.data
            .libraries
            .iter()
            .map(|(id, entry)| (id.as_str(), entry))
    }

    pub fn find_by_path(&self, path: &Path) -> Option<(&str, &RegistryEntry)> {
        let normalized = normalize_path(path).ok()?;
        self.data.libraries.iter().find_map(|(id, entry)| {
            same_path(&entry.path, &normalized).then_some((id.as_str(), entry))
        })
    }

    /// 登记已有的知识库 metadata。发生复制冲突时不修改 registry，由调用方
    /// 生成新 ID 后再次登记。
    pub fn register(
        &mut self,
        metadata: &LibraryMetadata,
        path: &Path,
    ) -> Result<RegisterOutcome, String> {
        let normalized = normalize_path(path)?;

        if let Some(existing) = self.data.libraries.get(metadata.id.as_str()) {
            if same_path(&existing.path, &normalized) {
                let entry = self
                    .data
                    .libraries
                    .get_mut(metadata.id.as_str())
                    .expect("entry checked above");
                entry.title = metadata.title.clone();
                return Ok(RegisterOutcome::Existing);
            }
            if !Path::new(&existing.path).exists() {
                let entry = self
                    .data
                    .libraries
                    .get_mut(metadata.id.as_str())
                    .expect("entry checked above");
                entry.path = normalized;
                entry.title = metadata.title.clone();
                return Ok(RegisterOutcome::Moved);
            }
            return Ok(RegisterOutcome::CopyConflict {
                existing_path: existing.path.clone(),
            });
        }

        if let Some(id) = self.find_by_path(path).map(|(id, _)| id.to_string()) {
            // 路径已有登记时沿用 registry 中的 ID，调用方以该 ID 为准。
            if id != metadata.id.as_str() {
                let entry = self
                    .data
                    .libraries
                    .get_mut(&id)
                    .expect("entry found by path");
                entry.title = metadata.title.clone();
                return Ok(RegisterOutcome::Existing);
            }
        }

        self.data.libraries.insert(
            metadata.id.as_str().to_string(),
            RegistryEntry {
                id: metadata.id.clone(),
                path: normalized,
                title: metadata.title.clone(),
            },
        );
        Ok(RegisterOutcome::Created)
    }

    pub fn relocate(&mut self, id: &LibraryId, path: &Path) -> Result<(), String> {
        if !path.exists() {
            return Err(format!("知识库路径不存在：{}", path.display()));
        }
        let normalized = normalize_path(path)?;
        if let Some((other_id, _)) = self.find_by_path(path) {
            if other_id != id.as_str() {
                return Err("该路径已经登记为另一个知识库".to_string());
            }
        }
        let entry = self
            .data
            .libraries
            .get_mut(id.as_str())
            .ok_or_else(|| format!("知识库未登记：{id}"))?;
        entry.path = normalized;
        Ok(())
    }

    pub fn set_title(&mut self, id: &LibraryId, title: &str) -> bool {
        let Some(entry) = self.data.libraries.get_mut(id.as_str()) else {
            return false;
        };
        entry.title = title.to_string();
        true
    }

    pub fn remove(&mut self, id: &LibraryId) -> bool {
        self.data.libraries.remove(id.as_str()).is_some()
    }
}

pub(crate) fn normalize_path(path: &Path) -> Result<String, String> {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        env::current_dir()
            .map_err(|error| format!("读取当前目录失败：{error}"))?
            .join(path)
    };
    let canonical = fs::canonicalize(&absolute).unwrap_or(absolute);
    Ok(strip_verbatim(&canonical.to_string_lossy()))
}

fn strip_verbatim(value: &str) -> String {
    if let Some(rest) = value.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else if let Some(rest) = value.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        value.to_string()
    }
}

fn same_path(left: &str, right: &str) -> bool {
    if cfg!(windows) {
        left.eq_ignore_ascii_case(right)
    } else {
        left == right
    }
}

#[cfg(test)]
mod tests {
    use super::{LibraryRegistry, RegisterOutcome};
    use std::fs;
    use std::path::PathBuf;
    use tauri_notes_workspace::library::{LibraryId, LibraryKind, LibraryMetadata};

    fn temp_dir(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "tauri-notes-registry-{name}-{}",
            std::process::id()
        ))
    }

    fn metadata(id: &str, title: &str) -> LibraryMetadata {
        LibraryMetadata {
            id: LibraryId::parse(id).unwrap(),
            title: title.to_string(),
            kind: LibraryKind::Note,
        }
    }

    #[test]
    fn rejects_other_registry_versions() {
        let root = temp_dir("old-version");
        let data = root.join("data");
        fs::create_dir_all(&data).unwrap();
        fs::write(
            data.join("libraries.json"),
            r#"{"version":2,"libraries":{"lib_old":{"id":"lib_old","path":"/old.note","title":"注册表"}}}"#,
        )
        .unwrap();

        assert!(LibraryRegistry::load(&data).is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn registers_and_round_trips() {
        let root = temp_dir("roundtrip");
        let data = root.join("data");
        fs::create_dir_all(&data).unwrap();
        let library = root.join("a.note");
        fs::write(&library, b"x").unwrap();

        let mut registry = LibraryRegistry::load(&data).unwrap();
        let outcome = registry
            .register(&metadata("lib_a", "知识库 A"), &library)
            .unwrap();
        assert_eq!(outcome, RegisterOutcome::Created);
        let entry = registry.get(&LibraryId::parse("lib_a").unwrap()).unwrap();
        assert_eq!(entry.id.as_str(), "lib_a");
        assert_eq!(entry.title, "知识库 A");
        assert!(registry.set_title(&LibraryId::parse("lib_a").unwrap(), "知识库 B"));
        registry.save().unwrap();

        let loaded = LibraryRegistry::load(&data).unwrap();
        let entry = loaded.get(&LibraryId::parse("lib_a").unwrap()).unwrap();
        assert_eq!(entry.title, "知识库 B");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn treats_missing_old_path_as_move() {
        let root = temp_dir("move");
        let data = root.join("data");
        fs::create_dir_all(&data).unwrap();
        let old = root.join("old.note");
        let new = root.join("new.note");
        fs::write(&old, b"x").unwrap();

        let mut registry = LibraryRegistry::load(&data).unwrap();
        let metadata = metadata("lib_move", "移动");
        registry.register(&metadata, &old).unwrap();
        fs::remove_file(&old).unwrap();
        fs::write(&new, b"x").unwrap();
        let outcome = registry.register(&metadata, &new).unwrap();
        assert_eq!(outcome, RegisterOutcome::Moved);
        assert_eq!(
            registry.get(&metadata.id).unwrap().path,
            new.to_string_lossy()
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_copy_conflict_when_old_path_still_exists() {
        let root = temp_dir("copy");
        let data = root.join("data");
        fs::create_dir_all(&data).unwrap();
        let first = root.join("first.note");
        let copy = root.join("copy.note");
        fs::write(&first, b"x").unwrap();
        fs::write(&copy, b"x").unwrap();

        let mut registry = LibraryRegistry::load(&data).unwrap();
        let metadata = metadata("lib_copy", "复制");
        registry.register(&metadata, &first).unwrap();
        let outcome = registry.register(&metadata, &copy).unwrap();
        assert!(matches!(outcome, RegisterOutcome::CopyConflict { .. }));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn relocates_and_removes_entry() {
        let root = temp_dir("relocate");
        let data = root.join("data");
        fs::create_dir_all(&data).unwrap();
        let first = root.join("first.note");
        let moved = root.join("moved.note");
        fs::write(&first, b"x").unwrap();
        fs::write(&moved, b"x").unwrap();

        let mut registry = LibraryRegistry::load(&data).unwrap();
        let metadata = metadata("lib_relocate", "重新定位");
        registry.register(&metadata, &first).unwrap();
        registry.relocate(&metadata.id, &moved).unwrap();
        assert_eq!(
            registry.get(&metadata.id).unwrap().path,
            moved.to_string_lossy()
        );
        assert!(registry.remove(&metadata.id));
        assert!(registry.get(&metadata.id).is_none());
        fs::remove_dir_all(root).unwrap();
    }
}
