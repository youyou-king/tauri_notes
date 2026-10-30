use tauri_notes_storage::database;
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceTarget {
    pub block_id: String,
    pub document_id: String,
    pub document_title: String,
    pub block_type: String,
    pub preview: String,
}

pub async fn list_reference_targets(
    workspace: String,
) -> Result<Vec<ReferenceTarget>, String> {
    let mut connection = database::open_for_import(&workspace).await?;
    let rows = sqlx::query_as::<_, (String, String, String, String, String)>(
        "SELECT b.id, b.document_id, d.title, b.type, b.plain_text
         FROM blocks b
         JOIN documents d ON d.id = b.document_id
         WHERE b.type <> 'viewport'
         ORDER BY d.title, b.order_key
         LIMIT 200",
    )
    .fetch_all(&mut connection)
    .await
    .map_err(|error| format!("读取目标块失败: {error}"))?;
    Ok(rows
        .into_iter()
        .map(|row| ReferenceTarget {
            block_id: row.0,
            document_id: row.1,
            document_title: row.2,
            block_type: row.3,
            preview: row.4,
        })
        .collect())
}

pub async fn relink_reference(
    workspace: String,
    reference_id: String,
    target_document_id: String,
    target_block_id: String,
) -> Result<(), String> {
    let mut connection = database::open_for_import(&workspace).await?;
    let exists = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM blocks WHERE id = ?1 AND document_id = ?2",
    )
    .bind(&target_block_id)
    .bind(&target_document_id)
    .fetch_one(&mut connection)
    .await
    .map_err(|error| format!("校验目标块失败: {error}"))?;
    if exists == 0 {
        return Err("目标块不存在".into());
    }
    sqlx::query(
        "UPDATE block_references
         SET target_document_id = ?1, target_block_id = ?2
         WHERE id = ?3",
    )
    .bind(target_document_id)
    .bind(target_block_id)
    .bind(reference_id)
    .execute(&mut connection)
    .await
    .map_err(|error| format!("重新关联失败: {error}"))?;
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferencePreview {
    pub reference_id: String,
    pub document_id: String,
    pub block_id: String,
    pub document_title: String,
    pub block_type: String,
    pub plain_text: String,
    pub content_json: String,
}

pub async fn load_reference_preview(
    workspace: String,
    reference_id: String,
) -> Result<ReferencePreview, String> {
    let mut connection = database::open_for_import(&workspace).await?;
    let row = sqlx::query_as::<_, (String, String, String, String, String, String, String)>(
        "SELECT r.id, r.target_document_id, r.target_block_id,
                d.title, b.plain_text, b.content_json, b.type
         FROM block_references r
         JOIN blocks b ON b.id = r.target_block_id
         JOIN documents d ON d.id = r.target_document_id
         WHERE r.id = ?1",
    )
    .bind(reference_id)
    .fetch_optional(&mut connection)
    .await
    .map_err(|error| format!("读取引用失败: {error}"))?
    .ok_or_else(|| "引用已失效或目标块不存在".to_string())?;

    Ok(ReferencePreview {
        reference_id: row.0,
        document_id: row.1,
        block_id: row.2,
        document_title: row.3,
        block_type: row.6,
        plain_text: row.4,
        content_json: row.5,
    })
}
