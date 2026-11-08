//! 书库可写能力：由实际存储操作确认，而不是猜测文件系统属性。
//!
//! Windows 目录的 ReadOnly 属性并不代表不可写；`.note` 也可能正被
//! SQLite 连接持有。因此这里不探测目录属性，也不对 `.note` 做写打开，
//! 而是让数据库或元数据写入成为唯一判据。

use std::fmt;
use std::fs;
use std::path::Path;

use tauri_notes_storage::database::{self, DatabaseAccessError};

const READ_ONLY_NOTE_MESSAGE: &str =
    "该 .note 文件为只读，当前版本不支持直接打开。请复制到可写目录后重试。";

const READ_ONLY_DIRECTORY_MESSAGE: &str =
    "该 .notes 目录为只读，当前版本不支持直接打开。请复制到可写目录后重试。";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LibraryAccessError {
    ReadOnlyNote,
    ReadOnlyDirectory,
    Io(String),
}

impl fmt::Display for LibraryAccessError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ReadOnlyNote => formatter.write_str(READ_ONLY_NOTE_MESSAGE),
            Self::ReadOnlyDirectory => formatter.write_str(READ_ONLY_DIRECTORY_MESSAGE),
            Self::Io(message) => formatter.write_str(message),
        }
    }
}

pub async fn ensure_note_writable(path: &Path) -> Result<(), LibraryAccessError> {
    let workspace = path.to_string_lossy();
    database::ensure_writable(&workspace)
        .await
        .map_err(|error| match error {
            DatabaseAccessError::ReadOnly => LibraryAccessError::ReadOnlyNote,
            DatabaseAccessError::Io(message) => LibraryAccessError::Io(message),
        })
}

pub fn ensure_directory_writable(path: &Path) -> Result<(), LibraryAccessError> {
    let meta_path = path.join("meta.json");
    let metadata = fs::metadata(&meta_path).map_err(|error| {
        LibraryAccessError::Io(format!("读取 {} 失败：{error}", meta_path.display()))
    })?;
    if metadata.permissions().readonly() {
        return Err(LibraryAccessError::ReadOnlyDirectory);
    }
    fs::OpenOptions::new()
        .write(true)
        .open(&meta_path)
        .map(|_| ())
        .map_err(|_| LibraryAccessError::ReadOnlyDirectory)
}
