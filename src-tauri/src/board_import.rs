use crate::database;
use serde::{Deserialize, Serialize};
use sqlx::Connection;
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OldReference {
    block_id: String,
    last_doc_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OldBoardItem {
    id: String,
    reference: OldReference,
    #[serde(default)]
    span: Option<i64>,
    #[serde(default)]
    width: Option<f64>,
    height: f64,
    zoom: f64,
    #[serde(default)]
    collapsed: bool,
}

#[derive(Debug, Deserialize)]
struct OldBoard {
    version: u32,
    id: String,
    title: String,
    items: Vec<OldBoardItem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardImportReport {
    pub boards: usize,
    pub items: usize,
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

fn read_board(path: &Path) -> Result<OldBoard, String> {
    let text = fs::read_to_string(path)
        .map_err(|error| format!("读取 {}: {error}", path.display()))?;
    let board: OldBoard = serde_json::from_str(&text)
        .map_err(|error| format!("解析 {}: {error}", path.display()))?;
    if board.version != 1 {
        return Err(format!(
            "不支持的 board 版本 {}: {}",
            board.version,
            path.display()
        ));
    }
    Ok(board)
}

#[tauri::command]
pub async fn import_boards(workspace: String) -> Result<BoardImportReport, String> {
    let boards_dir = Path::new(&workspace).join("boards");
    if !boards_dir.exists() {
        return Ok(BoardImportReport {
            boards: 0,
            items: 0,
        });
    }

    let mut paths: Vec<_> = fs::read_dir(&boards_dir)
        .map_err(|error| format!("读取 boards 目录失败: {error}"))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("json"))
        .collect();
    paths.sort();

    let mut boards = Vec::new();
    for path in paths {
        boards.push(read_board(&path)?);
    }

    let mut connection = database::open_for_import(&workspace).await?;
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("开启 board 导入事务失败: {error}"))?;
    let now = timestamp();
    let mut item_count = 0usize;

    sqlx::query("DELETE FROM block_references WHERE viewport_block_id IS NULL")
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("清理旧 board 引用失败: {error}"))?;

    for board in &boards {
        sqlx::query(
            "INSERT INTO boards (id, title, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?3)
             ON CONFLICT(id) DO UPDATE SET
               title = excluded.title,
               updated_at = excluded.updated_at",
        )
        .bind(&board.id)
        .bind(&board.title)
        .bind(&now)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("写入 board {} 失败: {error}", board.id))?;

        sqlx::query("DELETE FROM board_items WHERE board_id = ?1")
            .bind(&board.id)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("清理 board items 失败: {error}"))?;

        for (index, item) in board.items.iter().enumerate() {
            let reference_id = format!(
                "ref_board_{:08x}",
                fnv(&format!("{}:{}", board.id, item.id))
            );
            let item_id = if item.id.is_empty() {
                format!("bitem_{:08x}", fnv(&format!("{}:{index}", board.id)))
            } else {
                item.id.clone()
            };
            let span = item
                .span
                .or_else(|| item.width.map(|value| value.round() as i64))
                .unwrap_or(1)
                .clamp(1, 12);
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
            .map_err(|error| format!("写入 board reference 失败: {error}"))?;

            sqlx::query(
                "INSERT INTO board_items
                 (id, board_id, reference_id, order_key, span, height_px, zoom, collapsed)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            )
            .bind(item_id)
            .bind(&board.id)
            .bind(reference_id)
            .bind(format!("{:08}", index))
            .bind(span)
            .bind(item.height.round() as i64)
            .bind(item.zoom)
            .bind(i64::from(item.collapsed))
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("写入 board item 失败: {error}"))?;
            item_count += 1;
        }
    }

    transaction
        .commit()
        .await
        .map_err(|error| format!("提交 board 导入失败: {error}"))?;
    Ok(BoardImportReport {
        boards: boards.len(),
        items: item_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_old_board_and_new_span() {
        let board: OldBoard = serde_json::from_str(
            r#"{
              "version": 1,
              "id": "board_a",
              "title": "对照板",
              "items": [{
                "id": "viewport_1",
                "reference": {
                  "blockId": "block_a1b2",
                  "lastDocId": "map_001/node_001"
                },
                "span": 2,
                "height": 240.0,
                "zoom": 1.25
              }]
            }"#,
        )
        .expect("board");
        assert_eq!(board.items[0].span, Some(2));
        assert_eq!(board.items[0].height, 240.0);
    }
}
