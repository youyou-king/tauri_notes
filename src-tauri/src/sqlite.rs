use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode};
use sqlx::{Connection, SqliteConnection};
use std::path::{Path, PathBuf};
use std::time::Duration;

pub fn database_path(workspace: &str, name: &str) -> PathBuf {
    let path = Path::new(workspace);
    if path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("note"))
    {
        return path.to_path_buf();
    }
    path.join(name)
}

pub async fn connect(path: &Path) -> Result<SqliteConnection, String> {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .busy_timeout(Duration::from_secs(5));
    let mut connection = SqliteConnection::connect_with(&options)
        .await
        .map_err(|error| format!("打开 {} 失败: {error}", path.display()))?;
    sqlx::query("PRAGMA busy_timeout = 5000")
        .execute(&mut connection)
        .await
        .map_err(|error| format!("设置 SQLite busy timeout 失败: {error}"))?;
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&mut connection)
        .await
        .map_err(|error| format!("启用 SQLite 外键失败: {error}"))?;
    Ok(connection)
}
