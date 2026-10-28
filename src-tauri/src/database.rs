use crate::sqlite;
use serde::Serialize;
use sqlx::SqliteConnection;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub const SCHEMA_VERSION: i64 = 6;

static DATABASE_INIT_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

const MIGRATION_1: &str = r#"
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
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
  created_at TEXT NOT NULL
) STRICT;

CREATE VIRTUAL TABLE IF NOT EXISTS block_fts USING fts5(
  block_id UNINDEXED,
  title,
  content
);
"#;

const MIGRATION_2: &str = r#"
ALTER TABLE documents ADD COLUMN map_id TEXT;
ALTER TABLE documents ADD COLUMN parent_id TEXT;
ALTER TABLE documents ADD COLUMN order_key TEXT NOT NULL DEFAULT '00000000';
CREATE INDEX IF NOT EXISTS documents_tree
  ON documents(map_id, parent_id, order_key);
"#;

const MIGRATION_3: &str = r#"
UPDATE blocks SET height_mode = 'auto', height_px = NULL;
"#;

const MIGRATION_4: &str = r#"
CREATE TABLE IF NOT EXISTS maps (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
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
  order_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS map_nodes_tree
  ON map_nodes(map_id, parent_id, order_key);

CREATE UNIQUE INDEX IF NOT EXISTS map_nodes_heading_unique
  ON map_nodes(map_id, document_id, heading_block_id)
  WHERE heading_block_id IS NOT NULL;
"#;

const MIGRATION_5: &str = r#"
ALTER TABLE assets ADD COLUMN data BLOB;
"#;

const MIGRATION_6: &str = r#"
ALTER TABLE maps ADD COLUMN document_id TEXT;
"#;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseStatus {
    pub version: i64,
    pub documents: i64,
    pub blocks: i64,
    pub references: i64,
    pub boards: i64,
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

async fn migrate(connection: &mut SqliteConnection) -> Result<i64, String> {    sqlx::query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
           version INTEGER PRIMARY KEY,
           applied_at TEXT NOT NULL
         ) STRICT",
    )
    .execute(&mut *connection)
    .await
    .map_err(|error| format!("创建 schema_migrations 失败: {error}"))?;

    let current: Option<i64> =
        sqlx::query_scalar("SELECT MAX(version) FROM schema_migrations")
            .fetch_one(&mut *connection)
            .await
            .map_err(|error| format!("读取 schema 版本失败: {error}"))?;

    if current.unwrap_or(0) < 1 {
        for statement in MIGRATION_1.split(';') {
            let sql = statement.trim();
            if sql.is_empty() {
                continue;
            }
            sqlx::query(sql)
                .execute(&mut *connection)
                .await
                .map_err(|error| format!("执行 schema v1 失败: {error}\n{sql}"))?;
        }
        sqlx::query("INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?1)")
            .bind(timestamp())
            .execute(&mut *connection)
            .await
            .map_err(|error| format!("记录 schema v1 失败: {error}"))?;
    }
    if current.unwrap_or(0) < 2 {
        for statement in MIGRATION_2.split(';') {
            let sql = statement.trim();
            if sql.is_empty() {
                continue;
            }
            sqlx::query(sql)
                .execute(&mut *connection)
                .await
                .map_err(|error| format!("执行 schema v2 失败: {error}\n{sql}"))?;
        }
        sqlx::query("INSERT INTO schema_migrations (version, applied_at) VALUES (2, ?1)")
            .bind(timestamp())
            .execute(&mut *connection)
            .await
            .map_err(|error| format!("记录 schema v2 失败: {error}"))?;
    }
    if current.unwrap_or(0) < 3 {
        for statement in MIGRATION_3.split(';') {
            let sql = statement.trim();
            if sql.is_empty() {
                continue;
            }
            sqlx::query(sql)
                .execute(&mut *connection)
                .await
                .map_err(|error| format!("执行 schema v3 失败: {error}\n{sql}"))?;
        }
        sqlx::query("INSERT INTO schema_migrations (version, applied_at) VALUES (3, ?1)")
            .bind(timestamp())
            .execute(&mut *connection)
            .await
            .map_err(|error| format!("记录 schema v3 失败: {error}"))?;
    }
    if current.unwrap_or(0) < 4 {
        for statement in MIGRATION_4.split(';') {
            let sql = statement.trim();
            if sql.is_empty() {
                continue;
            }
            sqlx::query(sql)
                .execute(&mut *connection)
                .await
                .map_err(|error| format!("执行 schema v4 失败: {error}\n{sql}"))?;
        }
        sqlx::query("INSERT INTO schema_migrations (version, applied_at) VALUES (4, ?1)")
            .bind(timestamp())
            .execute(&mut *connection)
            .await
            .map_err(|error| format!("记录 schema v4 失败: {error}"))?;
    }
    if current.unwrap_or(0) < 5 {
        for statement in MIGRATION_5.split(';') {
            let sql = statement.trim();
            if sql.is_empty() {
                continue;
            }
            sqlx::query(sql)
                .execute(&mut *connection)
                .await
                .map_err(|error| format!("执行 schema v5 失败: {error}\n{sql}"))?;
        }
        sqlx::query("INSERT INTO schema_migrations (version, applied_at) VALUES (5, ?1)")
            .bind(timestamp())
            .execute(&mut *connection)
            .await
            .map_err(|error| format!("记录 schema v5 失败: {error}"))?;
    }
    if current.unwrap_or(0) < 6 {
        for statement in MIGRATION_6.split(';') {
            let sql = statement.trim();
            if sql.is_empty() {
                continue;
            }
            sqlx::query(sql)
                .execute(&mut *connection)
                .await
                .map_err(|error| format!("执行 schema v6 失败: {error}\n{sql}"))?;
        }
        sqlx::query("INSERT INTO schema_migrations (version, applied_at) VALUES (6, ?1)")
            .bind(timestamp())
            .execute(&mut *connection)
            .await
            .map_err(|error| format!("记录 schema v6 失败: {error}"))?;
    }
    Ok(SCHEMA_VERSION)
}

async fn read_status(connection: &mut SqliteConnection) -> Result<DatabaseStatus, String> {
    let version: Option<i64> =
        sqlx::query_scalar("SELECT MAX(version) FROM schema_migrations")
            .fetch_one(&mut *connection)
            .await
            .map_err(|error| format!("读取 schema 版本失败: {error}"))?;
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
        version: version.unwrap_or(0),
        documents,
        blocks,
        references,
        boards,
    })
}

pub(crate) async fn open_for_import(
    workspace: &str,
) -> Result<SqliteConnection, String> {
    let _guard = DATABASE_INIT_LOCK.lock().await;
    let path = database_path(workspace);
    let mut connection = sqlite::connect(&path).await?;
    migrate(&mut connection).await?;
    Ok(connection)
}

#[tauri::command]
pub async fn initialize_database(workspace: String) -> Result<DatabaseStatus, String> {
    let mut connection = open_for_import(&workspace).await?;
    read_status(&mut connection).await
}

#[tauri::command]
pub async fn database_status(workspace: String) -> Result<DatabaseStatus, String> {
    let mut connection = open_for_import(&workspace).await?;
    read_status(&mut connection).await
}

#[tauri::command]
pub async fn backup_database(workspace: String) -> Result<String, String> {
    let mut connection = open_for_import(&workspace).await?;
    let backup_dir = Path::new(&workspace).join("backups");
    std::fs::create_dir_all(&backup_dir)
        .map_err(|error| format!("创建备份目录失败: {error}"))?;
    let target = backup_dir.join(format!("notes-{}.db", timestamp()));
    let target_text = target.to_string_lossy().replace('\'', "''");
    sqlx::query(&format!("VACUUM INTO '{}'", target_text))
        .execute(&mut connection)
        .await
        .map_err(|error| format!("备份数据库失败: {error}"))?;
    Ok(target.to_string_lossy().into_owned())
}

