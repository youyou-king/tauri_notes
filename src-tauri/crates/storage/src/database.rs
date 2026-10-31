use crate::sqlite;
use serde::Serialize;
use sqlx::{Connection, SqliteConnection};
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

async fn backup_before_migration(
    connection: &mut SqliteConnection,
    path: &Path,
    version: i64,
) -> Result<(), String> {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let target = if path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("note"))
    {
        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("notes.note");
        path.with_file_name(format!(
            "{name}.schema-v{version}-{}-{stamp}.bak",
            std::process::id(),
        ))
    } else {
        let dir = path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join("backups");
        std::fs::create_dir_all(&dir)
            .map_err(|error| format!("创建迁移备份目录失败: {error}"))?;
        dir.join(format!(
            "notes-schema-v{version}-{}-{stamp}.db",
            std::process::id(),
        ))
    };
    let target_text = target.to_string_lossy().replace('\'', "\'\'");
    sqlx::query(&format!("VACUUM INTO '{target_text}'"))
        .execute(&mut *connection)
        .await
        .map_err(|error| format!("迁移前备份失败: {error}"))?;
    Ok(())
}

async fn apply_migration(
    connection: &mut SqliteConnection,
    version: i64,
    sql: &str,
) -> Result<(), String> {
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("开始 schema v{version} 事务失败: {error}"))?;
    for statement in sql.split(';') {
        let statement = statement.trim();
        if statement.is_empty() {
            continue;
        }
        sqlx::query(statement)
            .execute(&mut *transaction)
            .await
            .map_err(|error| {
                format!("执行 schema v{version} 失败: {error}\n{statement}")
            })?;
    }
    sqlx::query(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
    )
    .bind(version)
    .bind(timestamp())
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("记录 schema v{version} 失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交 schema v{version} 事务失败: {error}"))
}

async fn migrate(connection: &mut SqliteConnection, path: &Path) -> Result<i64, String> {    sqlx::query(
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

    if current.unwrap_or(0) > 0 && current.unwrap_or(0) < SCHEMA_VERSION {
        backup_before_migration(connection, path, current.unwrap_or(0)).await?;
    }

    for version in 1..=SCHEMA_VERSION {
        if current.unwrap_or(0) < version {
            let migration = match version {
                1 => MIGRATION_1,
                2 => MIGRATION_2,
                3 => MIGRATION_3,
                4 => MIGRATION_4,
                5 => MIGRATION_5,
                6 => MIGRATION_6,
                _ => return Err(format!("未知 schema 版本 {version}")),
            };
            apply_migration(connection, version, migration).await?;
        }
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

pub async fn open_for_import(
    workspace: &str,
) -> Result<SqliteConnection, String> {
    let _guard = DATABASE_INIT_LOCK.lock().await;
    let path = database_path(workspace);
    let mut connection = sqlite::connect(&path).await?;
    migrate(&mut connection, &path).await?;
    Ok(connection)
}

pub async fn initialize_database(workspace: String) -> Result<DatabaseStatus, String> {
    let mut connection = open_for_import(&workspace).await?;
    read_status(&mut connection).await
}

pub async fn database_status(workspace: String) -> Result<DatabaseStatus, String> {
    let mut connection = open_for_import(&workspace).await?;
    read_status(&mut connection).await
}

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

#[cfg(test)]
mod tests {
    use super::{
        initialize_database, open_for_import, MIGRATION_1, SCHEMA_VERSION,
    };
    use crate::sqlite;
    use std::fs;
    use std::path::PathBuf;

    fn block_on<F: std::future::Future>(future: F) -> F::Output {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("runtime")
            .block_on(future)
    }

    fn workspace(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "tauri-notes-storage-{name}-{}",
            std::process::id()
        ))
    }

    #[test]
    fn initializes_schema_and_is_idempotent() {
        let root = workspace("migrate");
        fs::create_dir_all(&root).unwrap();
        let path = root.to_string_lossy().into_owned();

        block_on(async {
            let first = initialize_database(path.clone()).await.unwrap();
            assert_eq!(first.version, SCHEMA_VERSION);
            assert_eq!(first.documents, 0);

            let second = initialize_database(path.clone()).await.unwrap();
            assert_eq!(second.version, SCHEMA_VERSION);

            let mut connection = open_for_import(&path).await.unwrap();
            let applied: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM schema_migrations")
                    .fetch_one(&mut connection)
                    .await
                    .unwrap();
            assert_eq!(applied, SCHEMA_VERSION);
        });
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn upgrades_v1_database_to_latest_schema() {
        let root = workspace("upgrade");
        fs::create_dir_all(&root).unwrap();
        let path = root.join("notes.db");
        let workspace_text = root.to_string_lossy().into_owned();

        block_on(async {
            let mut connection = sqlite::connect(&path).await.unwrap();
            sqlx::query(
                "CREATE TABLE schema_migrations (
                   version INTEGER PRIMARY KEY,
                   applied_at TEXT NOT NULL
                 ) STRICT",
            )
            .execute(&mut connection)
            .await
            .unwrap();
            for statement in MIGRATION_1.split(';') {
                let sql = statement.trim();
                if !sql.is_empty() {
                    sqlx::query(sql).execute(&mut connection).await.unwrap();
                }
            }
            sqlx::query(
                "INSERT INTO schema_migrations (version, applied_at)
                 VALUES (1, '0')",
            )
            .execute(&mut connection)
            .await
            .unwrap();
            drop(connection);

            let status =
                initialize_database(workspace_text.clone()).await.unwrap();
            assert_eq!(status.version, SCHEMA_VERSION);

            let backups = fs::read_dir(root.join("backups")).unwrap();
            assert!(
                backups.into_iter().any(|entry| entry.is_ok()),
                "migration must leave a backup"
            );

            let mut connection =
                open_for_import(&workspace_text).await.unwrap();
            for (table, column) in [
                ("documents", "map_id"),
                ("documents", "order_key"),
                ("assets", "data"),
                ("maps", "document_id"),
            ] {
                let exists: i64 = sqlx::query_scalar(
                    "SELECT COUNT(*) FROM pragma_table_info(?1)
                     WHERE name = ?2",
                )
                .bind(table)
                .bind(column)
                .fetch_one(&mut connection)
                .await
                .unwrap();
                assert_eq!(exists, 1, "missing {table}.{column}");
            }
        });
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn failed_migration_rolls_back_version() {
        let root = workspace("rollback");
        fs::create_dir_all(&root).unwrap();
        let path = root.join("notes.db");
        let workspace_text = root.to_string_lossy().into_owned();

        block_on(async {
            let mut connection = sqlite::connect(&path).await.unwrap();
            sqlx::query(
                "CREATE TABLE schema_migrations (
                   version INTEGER PRIMARY KEY,
                   applied_at TEXT NOT NULL
                 ) STRICT",
            )
            .execute(&mut connection)
            .await
            .unwrap();
            for statement in MIGRATION_1.split(';') {
                let sql = statement.trim();
                if !sql.is_empty() {
                    sqlx::query(sql).execute(&mut connection).await.unwrap();
                }
            }
            sqlx::query(
                "INSERT INTO schema_migrations (version, applied_at)
                 VALUES (1, '0')",
            )
            .execute(&mut connection)
            .await
            .unwrap();
            // Simulate a migration that applied DDL but never recorded v2.
            sqlx::query("ALTER TABLE documents ADD COLUMN map_id TEXT")
                .execute(&mut connection)
                .await
                .unwrap();
            drop(connection);

            let error = initialize_database(workspace_text)
                .await
                .expect_err("migration must fail");
            assert!(error.contains("schema v2"), "{error}");

            let mut connection = sqlite::connect(&path).await.unwrap();
            let applied: Option<i64> =
                sqlx::query_scalar("SELECT MAX(version) FROM schema_migrations")
                    .fetch_one(&mut connection)
                    .await
                    .unwrap();
            assert_eq!(applied, Some(1));
        });
        fs::remove_dir_all(root).unwrap();
    }

}

