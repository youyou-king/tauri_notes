use crate::database;
use serde::{Deserialize, Serialize};
use sqlx::Connection;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardSummary {
    pub id: String,
    pub title: String,
    pub item_count: i64,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardReference {
    pub block_id: String,
    pub last_doc_id: String,
    pub last_title: String,
    pub fingerprint: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardItem {
    pub id: String,
    pub reference: BoardReference,
    pub span: i64,
    pub height: f64,
    pub zoom: f64,
    pub collapsed: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Board {
    pub version: u32,
    pub id: String,
    pub title: String,
    pub items: Vec<BoardItem>,
}

fn timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_default()
}

fn fnv(value: &str) -> u32 {
    let mut hash = 2166136261u32;
    for byte in value.as_bytes() {
        hash ^= u32::from(*byte);
        hash = hash.wrapping_mul(16777619);
    }
    hash
}

fn valid_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 100
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '-'))
}

fn reference_prefix(board_id: &str) -> String {
    format!("ref_boardb_{:08x}_", fnv(board_id))
}

#[tauri::command]
pub async fn list_boards_db(workspace: String) -> Result<Vec<BoardSummary>, String> {
    let mut connection = database::open_for_import(&workspace).await?;
    let rows = sqlx::query_as::<_, (String, String, i64, String)>(
        "SELECT b.id, b.title, COUNT(i.id), b.updated_at
         FROM boards b
         LEFT JOIN board_items i ON i.board_id = b.id
         GROUP BY b.id
         ORDER BY b.updated_at DESC",
    )
    .fetch_all(&mut connection)
    .await
    .map_err(|error| format!("读取对照板失败: {error}"))?;
    Ok(rows
        .into_iter()
        .map(|row| BoardSummary {
            id: row.0,
            title: row.1,
            item_count: row.2,
            updated_at: row.3,
        })
        .collect())
}

#[tauri::command]
pub async fn read_board_db(workspace: String, board_id: String) -> Result<Board, String> {
    let mut connection = database::open_for_import(&workspace).await?;
    let board = sqlx::query_as::<_, (String, String)>(
        "SELECT id, title FROM boards WHERE id = ?1",
    )
    .bind(&board_id)
    .fetch_optional(&mut connection)
    .await
    .map_err(|error| format!("读取对照板失败: {error}"))?
    .ok_or_else(|| "对照板不存在".to_string())?;

    let rows = sqlx::query_as::<
        _,
        (String, i64, i64, f64, i64, String, String, Option<String>, Option<String>, Option<String>),
    >(
        "SELECT i.id, i.span, i.height_px, i.zoom, i.collapsed,
                r.target_document_id, r.target_block_id,
                d.title, b.plain_text, b.content_json
         FROM board_items i
         JOIN block_references r ON r.id = i.reference_id
         LEFT JOIN documents d ON d.id = r.target_document_id
         LEFT JOIN blocks b ON b.id = r.target_block_id
         WHERE i.board_id = ?1
         ORDER BY i.order_key",
    )
    .bind(&board_id)
    .fetch_all(&mut connection)
    .await
    .map_err(|error| format!("读取对照板条目失败: {error}"))?;

    Ok(Board {
        version: 1,
        id: board.0,
        title: board.1,
        items: rows
            .into_iter()
            .map(|row| BoardItem {
                id: row.0,
                span: row.1.clamp(1, 3),
                height: row.2 as f64,
                zoom: row.3,
                collapsed: row.4 != 0,
                reference: BoardReference {
                    block_id: row.6,
                    last_doc_id: row.5,
                    last_title: row.7.unwrap_or_default(),
                    fingerprint: row
                        .9
                        .as_deref()
                        .map(|value| format!("{:08x}", fnv(value)))
                        .unwrap_or_default(),
                },
            })
            .collect(),
    })
}

#[tauri::command]
pub async fn save_board_db(workspace: String, board: Board) -> Result<(), String> {
    if board.version != 1 {
        return Err("不支持的对照板版本".into());
    }
    if !valid_id(&board.id) {
        return Err("无效的对照板 ID".into());
    }
    if board.title.trim().is_empty() {
        return Err("对照板标题不能为空".into());
    }
    let mut connection = database::open_for_import(&workspace).await?;
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("开启对照板事务失败: {error}"))?;
    let now = timestamp();
    let prefix = reference_prefix(&board.id);

    sqlx::query(
        "INSERT INTO boards (id, title, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?3)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           updated_at = excluded.updated_at",
    )
    .bind(&board.id)
    .bind(board.title.trim())
    .bind(&now)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("保存对照板失败: {error}"))?;

    sqlx::query("DELETE FROM board_items WHERE board_id = ?1")
        .bind(&board.id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("清理对照板条目失败: {error}"))?;
    sqlx::query(
        "DELETE FROM block_references
         WHERE viewport_block_id IS NULL AND substr(id, 1, ?1) = ?2",
    )
    .bind(prefix.len() as i64)
    .bind(&prefix)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("清理对照板引用失败: {error}"))?;

    for (index, item) in board.items.iter().enumerate() {
        if !valid_id(&item.id) {
            return Err(format!("无效的对照板条目 ID: {}", item.id));
        }
        let reference_id = format!("{prefix}{:08x}", fnv(&item.id));
        sqlx::query(
            "INSERT OR REPLACE INTO block_references
             (id, viewport_block_id, target_document_id, target_block_id, created_at)
             VALUES (?1, NULL, ?2, ?3, ?4)",
        )
        .bind(&reference_id)
        .bind(&item.reference.last_doc_id)
        .bind(&item.reference.block_id)
        .bind(&now)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("保存对照板引用失败: {error}"))?;

        sqlx::query(
            "INSERT INTO board_items
             (id, board_id, reference_id, order_key, span, height_px, zoom, collapsed)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        )
        .bind(&item.id)
        .bind(&board.id)
        .bind(reference_id)
        .bind(format!("{index:08}"))
        .bind(item.span.clamp(1, 3))
        .bind(item.height.round() as i64)
        .bind(item.zoom)
        .bind(i64::from(item.collapsed))
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("保存对照板条目失败: {error}"))?;
    }

    transaction
        .commit()
        .await
        .map_err(|error| format!("提交对照板失败: {error}"))
}

#[tauri::command]
pub async fn delete_board_db(workspace: String, board_id: String) -> Result<(), String> {
    let mut connection = database::open_for_import(&workspace).await?;
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("开启删除事务失败: {error}"))?;
    let prefix = reference_prefix(&board_id);
    sqlx::query(
        "DELETE FROM block_references
         WHERE viewport_block_id IS NULL AND substr(id, 1, ?1) = ?2",
    )
    .bind(prefix.len() as i64)
    .bind(&prefix)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("删除对照板引用失败: {error}"))?;
    sqlx::query("DELETE FROM boards WHERE id = ?1")
        .bind(board_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("删除对照板失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交删除失败: {error}"))
}
