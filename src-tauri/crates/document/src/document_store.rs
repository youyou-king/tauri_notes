use tauri_notes_storage::database;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Connection;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedDocument {
    pub id: String,
    pub title: String,
    pub block_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredBlock {
    pub id: String,
    pub document_id: String,
    pub block_type: String,
    pub order_key: String,
    pub width_span: i64,
    pub height_mode: String,
    pub height_px: Option<i64>,
    pub content_json: String,
    pub plain_text: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBlock {
    pub id: String,
    pub block_type: String,
    pub order_key: String,
    pub width_span: i64,
    pub height_mode: String,
    pub height_px: Option<i64>,
    pub content_json: String,
    pub plain_text: String,
}

fn heading_level(content_json: &str, plain_text: &str) -> usize {
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(content_json) {
        if let Some(kind) = value
            .get("attrs")
            .and_then(|attrs| attrs.get("kind"))
            .and_then(|kind| kind.as_str())
        {
            if let Some(level) = kind.strip_prefix("heading:") {
                if let Ok(level) = level.parse::<usize>() {
                    return level;
                }
            }
        }
        if let Some(level) = value
            .get("attrs")
            .and_then(|attrs| attrs.get("level"))
            .and_then(|level| level.as_u64())
        {
            return level as usize;
        }
    }
    plain_text.chars().take_while(|ch| *ch == '#').count()
}

fn heading_text(plain_text: &str) -> String {
    plain_text.trim_start_matches('#').trim().to_string()
}

pub async fn list_imported_documents(    workspace: String,
) -> Result<Vec<ImportedDocument>, String> {
    let mut connection = database::open_for_import(&workspace).await?;
    let rows: Vec<(String, String, i64)> = sqlx::query_as(
        "SELECT d.id, d.title, COUNT(b.id)
         FROM documents d
         LEFT JOIN blocks b ON b.document_id = d.id
         GROUP BY d.id, d.title
         ORDER BY d.title",
    )
    .fetch_all(&mut connection)
    .await
    .map_err(|error| format!("读取导入文档失败: {error}"))?;
    Ok(rows
        .into_iter()
        .map(|(id, title, block_count)| ImportedDocument {
            id,
            title,
            block_count,
        })
        .collect())
}

type BlockRow = (
    String,
    String,
    String,
    String,
    i64,
    String,
    Option<i64>,
    Option<String>,
    String,
);

pub async fn load_document_blocks(
    workspace: String,
    document_id: String,
) -> Result<Vec<StoredBlock>, String> {
    let mut connection = database::open_for_import(&workspace).await?;
    let rows: Vec<BlockRow> = sqlx::query_as(
        "SELECT id, document_id, type, order_key, width_span, height_mode,
                height_px, content_json, plain_text
         FROM blocks
         WHERE document_id = ?1
         ORDER BY order_key",
    )
    .bind(&document_id)
    .fetch_all(&mut connection)
    .await
    .map_err(|error| format!("读取文档块失败: {error}"))?;

    let linked: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM map_nodes WHERE document_id = ?1")
            .bind(&document_id)
            .fetch_one(&mut connection)
            .await
            .map_err(|error| format!("读取文档节点失败: {error}"))?;
    if linked > 0 {
        let title: Option<String> =
            sqlx::query_scalar("SELECT title FROM documents WHERE id = ?1")
                .bind(&document_id)
                .fetch_optional(&mut connection)
                .await
                .map_err(|error| format!("读取文档标题失败: {error}"))?;
        if let Some(title) = title {
            let self_heading_ids = rows
                .iter()
                .filter(|row| {
                    row.2 == "heading"
                        && heading_level(row.7.as_deref().unwrap_or_default(), &row.8) == 1
                        && heading_text(&row.8) == title.trim()
                })
                .map(|row| row.0.clone())
                .collect::<Vec<_>>();
            for block_id in &self_heading_ids {
                sqlx::query("DELETE FROM block_fts WHERE block_id = ?1")
                    .bind(block_id)
                    .execute(&mut connection)
                    .await
                    .map_err(|error| format!("删除重复标题索引失败: {error}"))?;
                sqlx::query("DELETE FROM blocks WHERE id = ?1")
                    .bind(block_id)
                    .execute(&mut connection)
                    .await
                    .map_err(|error| format!("删除重复标题失败: {error}"))?;
            }
            if !self_heading_ids.is_empty() {
                sqlx::query("UPDATE documents SET updated_at = ?1 WHERE id = ?2")
                    .bind(
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|duration| duration.as_secs().to_string())
                            .unwrap_or_default(),
                    )
                    .bind(&document_id)
                    .execute(&mut connection)
                    .await
                    .map_err(|error| format!("更新文档时间失败: {error}"))?;
            }
            let rows = rows
                .into_iter()
                .filter(|row| {
                    if row.2 != "heading" {
                        return true;
                    }
                    let content_json = row.7.as_deref().unwrap_or_default();
                    if heading_level(content_json, &row.8) != 1 {
                        return true;
                    }
                    heading_text(&row.8) != title.trim()
                })
                .collect::<Vec<_>>();
            return Ok(rows
                .into_iter()
                .map(
                    |(
                        id,
                        document_id,
                        block_type,
                        order_key,
                        width_span,
                        height_mode,
                        height_px,
                        content_json,
                        plain_text,
                    )| StoredBlock {
                        id,
                        document_id,
                        block_type,
                        order_key,
                        width_span,
                        height_mode,
                        height_px,
                        content_json: content_json.unwrap_or_default(),
                        plain_text,
                    },
                )
                .collect());
        }
    }

    Ok(rows
        .into_iter()
        .map(
            |(
                id,
                document_id,
                block_type,
                order_key,
                width_span,
                height_mode,
                height_px,
                content_json,
                plain_text,
            )| StoredBlock {
                id,
                document_id,
                block_type,
                order_key,
                width_span,
                height_mode,
                height_px,
                content_json: content_json.unwrap_or_default(),
                plain_text,
            },
        )
        .collect())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexedDbBlock {
    pub block_id: String,
    pub doc_id: String,
    pub doc_title: String,
    pub block_title: String,
    pub markdown: String,
    pub fingerprint: String,
    pub start_line: usize,
    pub end_line: usize,
    pub block_type: String,
    pub content_json: String,
}

fn fnv(value: &str) -> u32 {
    let mut hash = 2166136261u32;
    for byte in value.as_bytes() {
        hash ^= u32::from(*byte);
        hash = hash.wrapping_mul(16777619);
    }
    hash
}

pub async fn index_blocks_db(
    workspace: String,
) -> Result<Vec<IndexedDbBlock>, String> {
    let mut connection = database::open_for_import(&workspace).await?;
    let rows = sqlx::query_as::<_, (String, String, String, String, String, String)>(
        "SELECT b.id, b.document_id, d.title, b.type, b.plain_text, b.content_json
         FROM blocks b
         JOIN documents d ON d.id = b.document_id
         WHERE b.type <> 'viewport'
         ORDER BY d.title, b.order_key",
    )
    .fetch_all(&mut connection)
    .await
    .map_err(|error| format!("读取块索引失败: {error}"))?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let text = row.4.trim();
            let title = text
                .lines()
                .next()
                .unwrap_or("")
                .chars()
                .take(28)
                .collect::<String>();
            IndexedDbBlock {
                block_id: row.0,
                doc_id: row.1,
                doc_title: row.2,
                block_title: if title.is_empty() {
                    row.3.clone()
                } else {
                    title
                },
                markdown: text.to_string(),
                fingerprint: format!("{:08x}", fnv(&row.5)),
                start_line: 0,
                end_line: 0,
                block_type: row.3.clone(),
                content_json: row.5,
            }
        })
        .collect())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedDocument {
    pub id: String,
    pub title: String,
}

pub async fn create_imported_document(
    workspace: String,
    map_id: String,
    title: String,
) -> Result<CreatedDocument, String> {
    let map_id = map_id.trim();
    if map_id.is_empty()
        || !map_id
            .chars()
            .all(|value| value.is_ascii_alphanumeric() || matches!(value, '_' | '-'))
    {
        return Err("无效的导图 ID".into());
    }
    let title = title.trim();
    if title.is_empty() {
        return Err("文档标题不能为空".into());
    }
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let digest = fnv(&format!("{map_id}:{title}:{stamp}"));
    let document_id = format!("{map_id}/doc_{stamp:x}_{digest:08x}");
    let block_id = format!("block_new_{digest:08x}");
    let content = json!({
        "type": "paragraph",
        "attrs": {
            "blockId": block_id,
            "span": 12,
            "heightMode": "auto",
            "heightPx": 240
        },
        "content": []
    })
    .to_string();

    let mut connection = database::open_for_import(&workspace).await?;
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("开启新建事务失败: {error}"))?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_default();
    sqlx::query(
        "INSERT INTO documents
         (id, title, map_id, parent_id, order_key, created_at, updated_at)
         VALUES (?1, ?2, ?3, NULL, '00000000', ?4, ?4)",
    )
    .bind(&document_id)
    .bind(title)
    .bind(map_id)
    .bind(&now)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("创建文档失败: {error}"))?;
    sqlx::query(
        "INSERT INTO blocks
         (id, document_id, type, order_key, width_span, height_mode,
          height_px, content_json, content_schema, plain_text, updated_at)
         VALUES (?1, ?2, 'paragraph', '00000000', 12, 'auto', 240, ?3, 1, '', ?4)",
    )
    .bind(&block_id)
    .bind(&document_id)
    .bind(&content)
    .bind(&now)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("创建首块失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交新建文档失败: {error}"))?;

    Ok(CreatedDocument {
        id: document_id,
        title: title.to_string(),
    })
}

pub async fn get_imported_document_title(
    workspace: String,
    document_id: String,
) -> Result<String, String> {
    let mut connection = database::open_for_import(&workspace).await?;
    sqlx::query_scalar::<_, String>("SELECT title FROM documents WHERE id = ?1")
        .bind(&document_id)
        .fetch_optional(&mut connection)
        .await
        .map_err(|error| format!("读取文档标题失败: {error}"))?
        .ok_or_else(|| "文档不存在".to_string())
}

pub async fn rename_imported_document(
    workspace: String,
    document_id: String,
    title: String,
) -> Result<(), String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("文档标题不能为空".into());
    }
    let mut connection = database::open_for_import(&workspace).await?;
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("开启重命名事务失败: {error}"))?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_default();
    let result = sqlx::query(
        "UPDATE documents SET title = ?1, updated_at = ?2 WHERE id = ?3",
    )
    .bind(title)
    .bind(&now)
    .bind(&document_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("重命名失败: {error}"))?;
    if result.rows_affected() == 0 {
        return Err("文档不存在".into());
    }
    sqlx::query(
        "UPDATE map_nodes SET title = ?1, updated_at = ?2 WHERE document_id = ?3",
    )
    .bind(title)
    .bind(&now)
    .bind(&document_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("同步导图节点标题失败: {error}"))?;
    let links = sqlx::query_as::<_, (Option<String>, Option<String>)>(
        "SELECT heading_block_id, parent_id FROM map_nodes WHERE document_id = ?1",
    )
    .bind(&document_id)
    .fetch_all(&mut *transaction)
    .await
    .map_err(|error| format!("读取节点标题关联失败: {error}"))?;
    for (heading_block_id, parent_id) in links {
        let (Some(heading_block_id), Some(parent_id)) = (heading_block_id, parent_id) else {
            continue;
        };
        let parent_document: Option<String> =
            sqlx::query_scalar("SELECT document_id FROM map_nodes WHERE id = ?1")
                .bind(&parent_id)
                .fetch_optional(&mut *transaction)
                .await
                .map_err(|error| format!("读取父文档失败: {error}"))?
                .flatten();
        let Some(parent_document) = parent_document else {
            continue;
        };
        let block = sqlx::query_as::<_, (String, String)>(
            "SELECT type, content_json FROM blocks WHERE id = ?1 AND document_id = ?2",
        )
        .bind(&heading_block_id)
        .bind(&parent_document)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|error| format!("读取父标题块失败: {error}"))?;
        let Some((block_type, content_json)) = block else {
            continue;
        };
        let markdown = format!("# {title}");
        let mut value: serde_json::Value =
            serde_json::from_str(&content_json).unwrap_or_else(|_| serde_json::json!({}));
        if block_type == "rawMarkdown"
            || value
                .get("attrs")
                .and_then(|attrs| attrs.get("markdown"))
                .is_some()
        {
            value["attrs"]["markdown"] = serde_json::json!(markdown);
            if let Some(object) = value.as_object_mut() {
                object.remove("content");
            }
        } else {
            value["content"] = serde_json::json!([{ "type": "text", "text": title }]);
        }
        sqlx::query(
            "UPDATE blocks SET content_json = ?1, plain_text = ?2, updated_at = ?3
             WHERE id = ?4",
        )
        .bind(value.to_string())
        .bind(&markdown)
        .bind(&now)
        .bind(&heading_block_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("同步父标题块失败: {error}"))?;
        sqlx::query("UPDATE block_fts SET content = ?1 WHERE block_id = ?2")
            .bind(&markdown)
            .bind(&heading_block_id)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("同步父标题索引失败: {error}"))?;
    }
    sqlx::query(
        "UPDATE block_fts SET title = ?1
         WHERE block_id IN (SELECT id FROM blocks WHERE document_id = ?2)",
    )
    .bind(title)
    .bind(&document_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("更新搜索标题失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交重命名失败: {error}"))
}

pub async fn delete_imported_document(
    workspace: String,
    document_id: String,
) -> Result<(), String> {
    let mut connection = database::open_for_import(&workspace).await?;
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("开启删除事务失败: {error}"))?;
    sqlx::query(
        "DELETE FROM block_fts
         WHERE block_id IN (SELECT id FROM blocks WHERE document_id = ?1)",
    )
    .bind(&document_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("删除搜索索引失败: {error}"))?;
    sqlx::query(
        "DELETE FROM block_references
         WHERE target_document_id = ?1
            OR viewport_block_id IN (SELECT id FROM blocks WHERE document_id = ?1)",
    )
    .bind(&document_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("删除引用失败: {error}"))?;
    sqlx::query("DELETE FROM documents WHERE id = ?1")
        .bind(&document_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("删除文档失败: {error}"))?;
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交删除失败: {error}"))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentTreeNode {
    pub map_id: String,
    pub document_id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub order_key: String,
}

pub async fn load_document_tree(
    workspace: String,
) -> Result<Vec<DocumentTreeNode>, String> {
    let mut connection = database::open_for_import(&workspace).await?;
    let rows = sqlx::query_as::<_, (String, String, Option<String>, String, String)>(
        "SELECT map_id, id, parent_id, title, order_key
         FROM documents
         WHERE map_id IS NOT NULL
         ORDER BY map_id, order_key, title",
    )
    .fetch_all(&mut connection)
    .await
    .map_err(|error| format!("读取文档树失败: {error}"))?;
    Ok(rows
        .into_iter()
        .map(|row| DocumentTreeNode {
            map_id: row.0,
            document_id: row.1,
            parent_id: row.2,
            title: row.3,
            order_key: row.4,
        })
        .collect())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewBlock {
    pub block_id: String,
    pub document_id: String,
    pub document_title: String,
    pub block_type: String,
    pub plain_text: String,
    pub content_json: String,
}

pub async fn load_blocks_preview(
    workspace: String,
    block_ids: Vec<String>,
) -> Result<Vec<PreviewBlock>, String> {
    let mut connection = database::open_for_import(&workspace).await?;
    let mut previews = Vec::new();
    for block_id in block_ids {
        let row = sqlx::query_as::<_, (String, String, String, String, String, String)>(
            "SELECT b.id, b.document_id, d.title, b.type, b.plain_text, b.content_json
             FROM blocks b JOIN documents d ON d.id = b.document_id
             WHERE b.id = ?1",
        )
        .bind(&block_id)
        .fetch_optional(&mut connection)
        .await
        .map_err(|error| format!("读取引用块失败: {error}"))?;
        if let Some(row) = row {
            previews.push(PreviewBlock {
                block_id: row.0,
                document_id: row.1,
                document_title: row.2,
                block_type: row.3,
                plain_text: row.4,
                content_json: row.5,
            });
        }
    }
    Ok(previews)
}

pub async fn save_imported_blocks(
    workspace: String,
    document_id: String,
    blocks: Vec<SaveBlock>,
    deleted: Vec<String>,
) -> Result<(), String> {
    let mut connection = database::open_for_import(&workspace).await?;
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("开启保存事务失败: {error}"))?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_default();

    for block_id in &deleted {
        sqlx::query("DELETE FROM block_fts WHERE block_id = ?1")
            .bind(block_id)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("删除块 FTS 失败: {error}"))?;
        sqlx::query("DELETE FROM blocks WHERE id = ?1 AND document_id = ?2")
            .bind(block_id)
            .bind(&document_id)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("删除块失败: {error}"))?;
    }

    for block in &blocks {
        sqlx::query(
            "INSERT INTO blocks
             (id, document_id, type, order_key, width_span, height_mode,
              height_px, content_json, content_schema, plain_text, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?10)
             ON CONFLICT(id) DO UPDATE SET
               type = excluded.type,
               order_key = excluded.order_key,
               width_span = excluded.width_span,
               height_mode = excluded.height_mode,
               height_px = excluded.height_px,
               content_json = excluded.content_json,
               plain_text = excluded.plain_text,
               updated_at = excluded.updated_at",
        )
        .bind(&block.id)
        .bind(&document_id)
        .bind(&block.block_type)
        .bind(&block.order_key)
        .bind(block.width_span)
        .bind(&block.height_mode)
        .bind(block.height_px)
        .bind(&block.content_json)
        .bind(&block.plain_text)
        .bind(&now)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("保存块 {} 失败: {error}", block.id))?;

        sqlx::query("DELETE FROM block_fts WHERE block_id = ?1")
            .bind(&block.id)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("清理块 FTS 失败: {error}"))?;
        sqlx::query(
            "INSERT INTO block_fts (block_id, title, content)
             SELECT ?1, d.title, ?2 FROM documents d WHERE d.id = ?3",
        )
        .bind(&block.id)
        .bind(&block.plain_text)
        .bind(&document_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("更新块 FTS 失败: {error}"))?;
    }

    sqlx::query("UPDATE documents SET updated_at = ?1 WHERE id = ?2")
        .bind(&now)
        .bind(&document_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("更新文档时间失败: {error}"))?;

    transaction
        .commit()
        .await
        .map_err(|error| format!("提交保存事务失败: {error}"))?;
    crate::map_store::sync_document_headings(&workspace, &document_id).await?;
    Ok(())
}
