use crate::sqlite;
use serde::Serialize;
use sqlx::pool::PoolConnection;
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::{Connection, Sqlite, SqliteConnection, SqlitePool};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::{LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

static DATABASE_INIT_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
static INITIALIZED_DATABASES: LazyLock<Mutex<HashSet<std::path::PathBuf>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));
static DATABASE_POOLS: LazyLock<tokio::sync::Mutex<HashMap<std::path::PathBuf, SqlitePool>>> =
    LazyLock::new(|| tokio::sync::Mutex::new(HashMap::new()));

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DatabaseAccessError {
    ReadOnly,
    Io(String),
}

impl std::fmt::Display for DatabaseAccessError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ReadOnly => formatter.write_str("数据库为只读"),
            Self::Io(message) => formatter.write_str(message),
        }
    }
}

fn classify_access_error(message: String) -> DatabaseAccessError {
    let lower = message.to_ascii_lowercase();
    if lower.contains("readonly")
        || lower.contains("read-only")
        || lower.contains("permission denied")
        || lower.contains("access denied")
        || message.contains("拒绝访问")
        || message.contains("权限")
    {
        DatabaseAccessError::ReadOnly
    } else {
        DatabaseAccessError::Io(message)
    }
}

/// 用一次真实 schema 写入确认数据库可写；事务回滚，不修改数据。
pub async fn ensure_writable(workspace: &str) -> Result<(), DatabaseAccessError> {
    let path = database_path(workspace);
    let mut connection = sqlite::connect(&path)
        .await
        .map_err(classify_access_error)?;
    sqlx::query("BEGIN IMMEDIATE")
        .execute(&mut connection)
        .await
        .map_err(|error| classify_access_error(error.to_string()))?;
    let result = sqlx::query("CREATE TABLE IF NOT EXISTS __tauri_notes_write_probe (id INTEGER)")
        .execute(&mut connection)
        .await;
    if result.is_ok() {
        let _ = sqlx::query("DROP TABLE IF EXISTS __tauri_notes_write_probe")
            .execute(&mut connection)
            .await;
    }
    let _ = sqlx::query("ROLLBACK").execute(&mut connection).await;
    result
        .map(|_| ())
        .map_err(|error| classify_access_error(error.to_string()))
}

const CURRENT_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  map_id TEXT,
  parent_id TEXT,
  order_key TEXT NOT NULL DEFAULT '00000000',
  deleted_at TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  order_key TEXT NOT NULL,
  width_span INTEGER NOT NULL DEFAULT 12 CHECK(width_span BETWEEN 1 AND 12),
  height_mode TEXT NOT NULL DEFAULT 'auto' CHECK(height_mode IN ('auto', 'fixed')),
  height_px INTEGER,
  content_json TEXT,
  content_schema INTEGER NOT NULL DEFAULT 1,
  plain_text TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS blocks_document_order
  ON blocks(document_id, order_key);

CREATE TABLE IF NOT EXISTS block_references (
  id TEXT PRIMARY KEY,
  viewport_block_id TEXT REFERENCES blocks(id) ON DELETE CASCADE,
  target_document_id TEXT NOT NULL,
  target_block_id TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS block_references_target
  ON block_references(target_document_id, target_block_id);

CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS board_items (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  reference_id TEXT NOT NULL REFERENCES block_references(id) ON DELETE CASCADE,
  order_key TEXT NOT NULL,
  span INTEGER NOT NULL CHECK(span BETWEEN 1 AND 12),
  height_px INTEGER NOT NULL,
  zoom REAL NOT NULL,
  collapsed INTEGER NOT NULL DEFAULT 0 CHECK(collapsed IN (0, 1))
) STRICT;

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  mime TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  data BLOB,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS maps (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  document_id TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS map_nodes (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  parent_id TEXT,
  title TEXT NOT NULL,
  document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  heading_block_id TEXT,
  origin TEXT NOT NULL DEFAULT 'manual' CHECK(origin IN ('manual', 'heading', 'document')),
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0,
  position_saved INTEGER NOT NULL DEFAULT 0,
  order_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS map_nodes_tree
  ON map_nodes(map_id, parent_id, order_key);

CREATE UNIQUE INDEX IF NOT EXISTS map_nodes_heading_unique
  ON map_nodes(map_id, document_id, heading_block_id)
  WHERE heading_block_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS documents_tree
  ON documents(map_id, parent_id, order_key);

CREATE INDEX IF NOT EXISTS documents_deleted_at
  ON documents(deleted_at);

CREATE TABLE IF NOT EXISTS library_meta (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE VIRTUAL TABLE IF NOT EXISTS block_fts USING fts5(
  block_id UNINDEXED,
  title,
  content
);
"#;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseStatus {
    pub documents: i64,
    pub blocks: i64,
    pub references: i64,
    pub boards: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryMetadata {
    pub id: String,
    pub title: String,
}

/// 读取 `.note` 内的书库身份；空表返回 `None`。
pub async fn read_library_metadata(workspace: &str) -> Result<Option<LibraryMetadata>, String> {
    let mut connection = open_for_import(workspace).await?;
    let row: Option<(String, String)> =
        sqlx::query_as("SELECT id, title FROM library_meta LIMIT 1")
            .fetch_optional(&mut *connection)
            .await
            .map_err(|error| format!("读取书库身份失败: {error}"))?;
    Ok(row.map(|(id, title)| LibraryMetadata { id, title }))
}

/// 若 `.note` 还没有身份，写入调用方生成的身份；已有身份时原样返回。
pub async fn ensure_library_metadata(
    workspace: &str,
    id: &str,
    title: &str,
) -> Result<LibraryMetadata, String> {
    if let Some(existing) = read_library_metadata(workspace).await? {
        return Ok(existing);
    }
    replace_library_metadata(workspace, id, title).await
}

/// 覆盖 `.note` 内部的 ID/title，用于复制冲突时给副本分配新身份。
pub async fn replace_library_metadata(
    workspace: &str,
    id: &str,
    title: &str,
) -> Result<LibraryMetadata, String> {
    let mut connection = open_for_import(workspace).await?;
    sqlx::query("DELETE FROM library_meta")
        .execute(&mut *connection)
        .await
        .map_err(|error| format!("清理书库身份失败: {error}"))?;
    sqlx::query(
        "INSERT INTO library_meta (id, title, created_at)
         VALUES (?1, ?2, ?3)",
    )
    .bind(id)
    .bind(title)
    .bind(timestamp())
    .execute(&mut *connection)
    .await
    .map_err(|error| format!("写入书库身份失败: {error}"))?;
    Ok(LibraryMetadata {
        id: id.to_string(),
        title: title.to_string(),
    })
}

fn database_path(workspace: &str) -> std::path::PathBuf {
    sqlite::database_path(workspace, "notes.db")
}

fn timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_default()
}

async fn verify_backup(path: &Path) -> Result<(), String> {
    let mut connection = sqlite::connect(path)
        .await
        .map_err(|error| format!("备份文件无法打开 {}: {error}", path.display()))?;
    let integrity: String = sqlx::query_scalar("PRAGMA integrity_check")
        .fetch_one(&mut connection)
        .await
        .map_err(|error| format!("校验备份失败: {error}"))?;
    connection
        .close()
        .await
        .map_err(|error| format!("关闭备份连接失败: {error}"))?;
    if integrity != "ok" {
        return Err(format!("备份完整性校验失败: {integrity}"));
    }
    Ok(())
}

async fn create_schema(connection: &mut SqliteConnection) -> Result<(), String> {
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("开始 schema 事务失败: {error}"))?;
    for statement in CURRENT_SCHEMA.split(';') {
        let statement = statement.trim();
        if statement.is_empty() {
            continue;
        }
        sqlx::query(statement)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("执行 schema 失败: {error}\n{statement}"))?;
    }
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交 schema 事务失败: {error}"))
}

async fn read_status(connection: &mut SqliteConnection) -> Result<DatabaseStatus, String> {
    let documents: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM documents")
        .fetch_one(&mut *connection)
        .await
        .map_err(|error| format!("统计 documents 失败: {error}"))?;
    let blocks: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM blocks")
        .fetch_one(&mut *connection)
        .await
        .map_err(|error| format!("统计 blocks 失败: {error}"))?;
    let references: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM block_references")
        .fetch_one(&mut *connection)
        .await
        .map_err(|error| format!("统计 references 失败: {error}"))?;
    let boards: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM boards")
        .fetch_one(&mut *connection)
        .await
        .map_err(|error| format!("统计 boards 失败: {error}"))?;
    Ok(DatabaseStatus {
        documents,
        blocks,
        references,
        boards,
    })
}

async fn pool_for(path: &Path) -> Result<SqlitePool, String> {
    let mut pools = DATABASE_POOLS.lock().await;
    if let Some(pool) = pools.get(path) {
        return Ok(pool.clone());
    }
    let pool = SqlitePoolOptions::new()
        .max_connections(4)
        .connect_with(sqlite::connect_options(path))
        .await
        .map_err(|error| format!("打开 {} 失败: {error}", path.display()))?;
    pools.insert(path.to_path_buf(), pool.clone());
    Ok(pool)
}

pub async fn open_for_import(workspace: &str) -> Result<PoolConnection<Sqlite>, String> {
    let path = database_path(workspace);
    let pool = pool_for(&path).await?;
    let mut connection = pool
        .acquire()
        .await
        .map_err(|error| format!("获取数据库连接失败: {error}"))?;
    let already_initialized = INITIALIZED_DATABASES
        .lock()
        .map_err(|_| "数据库初始化状态锁已损坏".to_string())?
        .contains(&path);
    if already_initialized {
        return Ok(connection);
    }
    // Schema is created once per process for each workspace.
    let _guard = DATABASE_INIT_LOCK.lock().await;
    let already_initialized = INITIALIZED_DATABASES
        .lock()
        .map_err(|_| "数据库初始化状态锁已损坏".to_string())?
        .contains(&path);
    if !already_initialized {
        create_schema(&mut connection).await?;
        INITIALIZED_DATABASES
            .lock()
            .map_err(|_| "数据库初始化状态锁已损坏".to_string())?
            .insert(path);
    }
    Ok(connection)
}

/// Flushes WAL contents before copying a workspace file. Callers should not
/// open the database again until the copy has finished.
pub async fn close_workspace_pool(workspace: &str) {
    let path = database_path(workspace);
    let pool = DATABASE_POOLS.lock().await.remove(&path);
    if let Ok(mut initialized) = INITIALIZED_DATABASES.lock() {
        initialized.remove(&path);
    }
    if let Some(pool) = pool {
        pool.close().await;
    }
}

pub async fn initialize_database(workspace: String) -> Result<DatabaseStatus, String> {
    let mut connection = open_for_import(&workspace).await?;
    read_status(&mut connection).await
}

pub async fn database_status(workspace: String) -> Result<DatabaseStatus, String> {
    let mut connection = open_for_import(&workspace).await?;
    read_status(&mut connection).await
}

pub async fn verify_database(workspace: String) -> Result<(), String> {
    let mut connection = open_for_import(&workspace).await?;
    let integrity: String = sqlx::query_scalar("PRAGMA integrity_check")
        .fetch_one(&mut *connection)
        .await
        .map_err(|error| format!("校验数据库失败: {error}"))?;
    connection
        .close()
        .await
        .map_err(|error| format!("关闭数据库连接失败: {error}"))?;
    if integrity != "ok" {
        return Err(format!("数据库完整性校验失败: {integrity}"));
    }
    Ok(())
}

pub async fn backup_database(workspace: String) -> Result<String, String> {
    let mut connection = open_for_import(&workspace).await?;
    let backup_dir = Path::new(&workspace).join("backups");
    std::fs::create_dir_all(&backup_dir).map_err(|error| format!("创建备份目录失败: {error}"))?;
    let target = backup_dir.join(format!("notes-{}.db", timestamp()));
    let target_text = target.to_string_lossy().replace('\'', "''");
    sqlx::query(&format!("VACUUM INTO '{}'", target_text))
        .execute(&mut *connection)
        .await
        .map_err(|error| format!("备份数据库失败: {error}"))?;
    connection
        .close()
        .await
        .map_err(|error| format!("关闭数据库连接失败: {error}"))?;
    verify_backup(&target).await?;
    Ok(target.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::{
        backup_database, close_workspace_pool, ensure_library_metadata, initialize_database,
        read_library_metadata, verify_database,
    };
    use crate::sqlite;
    use sqlx::Connection;
    use std::fs;
    use std::path::PathBuf;

    fn block_on<F: std::future::Future>(future: F) -> F::Output {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("runtime")
            .block_on(future)
    }

    fn remove_dir_with_retry(root: &std::path::Path) {
        for _ in 0..20 {
            match std::fs::remove_dir_all(root) {
                Ok(()) => return,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => return,
                Err(_) => std::thread::sleep(std::time::Duration::from_millis(50)),
            }
        }
        std::fs::remove_dir_all(root).unwrap();
    }

    fn workspace(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("tauri-notes-storage-{name}-{}", std::process::id()))
    }

    #[test]
    fn keeps_note_as_a_single_file() {
        let root = workspace("single-file");
        fs::create_dir_all(&root).unwrap();
        let path = root.join("library.note");
        let text = path.to_string_lossy().into_owned();
        block_on(initialize_database(text.clone())).unwrap();
        block_on(close_workspace_pool(&text));

        assert!(path.is_file());
        assert!(!PathBuf::from(format!("{text}-wal")).exists());
        assert!(!PathBuf::from(format!("{text}-shm")).exists());
        remove_dir_with_retry(&root);
    }

    #[test]
    fn persists_library_metadata_without_overwriting_existing_id() {
        let root = workspace("library-meta");
        fs::create_dir_all(&root).unwrap();
        let path = root.to_string_lossy().into_owned();

        block_on(async {
            let first = ensure_library_metadata(&path, "lib_first", "测试书库")
                .await
                .unwrap();
            assert_eq!(first.id, "lib_first");
            assert_eq!(first.title, "测试书库");

            let second = ensure_library_metadata(&path, "lib_other", "另一个标题")
                .await
                .unwrap();
            assert_eq!(second.id, "lib_first");
            assert_eq!(second.title, "测试书库");

            let stored = read_library_metadata(&path).await.unwrap().unwrap();
            assert_eq!(stored.id, "lib_first");
            assert_eq!(stored.title, "测试书库");
            close_workspace_pool(&path).await;
        });
        remove_dir_with_retry(root.as_path());
    }

    #[test]
    fn initializes_schema_and_is_idempotent() {
        let root = workspace("schema");
        fs::create_dir_all(&root).unwrap();
        let path = root.to_string_lossy().into_owned();

        block_on(async {
            let first = initialize_database(path.clone()).await.unwrap();
            assert_eq!(first.documents, 0);

            let second = initialize_database(path.clone()).await.unwrap();
            assert_eq!(second.documents, 0);
            close_workspace_pool(&path).await;
        });
        remove_dir_with_retry(root.as_path());
    }

    #[test]
    fn backup_database_is_integrity_checked() {
        let root = workspace("backup");
        fs::create_dir_all(&root).unwrap();
        let path = root.to_string_lossy().into_owned();
        let backup = block_on(async {
            initialize_database(path).await.unwrap();
            let backup = backup_database(root.to_string_lossy().into_owned())
                .await
                .unwrap();
            close_workspace_pool(&root.to_string_lossy()).await;
            backup
        });
        let backup_path = PathBuf::from(backup);
        assert!(backup_path.is_file());
        block_on(async {
            let mut connection = sqlite::connect(&backup_path).await.unwrap();
            let integrity: String = sqlx::query_scalar("PRAGMA integrity_check")
                .fetch_one(&mut connection)
                .await
                .unwrap();
            assert_eq!(integrity, "ok");
            connection.close().await.unwrap();
        });
        remove_dir_with_retry(root.as_path());
    }

    #[test]
    fn verify_database_reports_ok() {
        let root = workspace("verify");
        fs::create_dir_all(&root).unwrap();
        let path = root.to_string_lossy().into_owned();
        block_on(async {
            initialize_database(path.clone()).await.unwrap();
            verify_database(path.clone()).await.unwrap();
            close_workspace_pool(&path).await;
        });
        remove_dir_with_retry(root.as_path());
    }
}
