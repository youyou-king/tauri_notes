use tauri_notes_storage::database;
use tauri_notes_document::document::{BlockKind, split_into_blocks};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{Connection, SqliteConnection};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Deserialize)]
struct MapIndex {
    maps: Vec<MapEntry>,
}

#[derive(Debug, Deserialize)]
struct MapEntry {
    id: String,
}

#[derive(Debug, Deserialize)]
struct TreeFile {
    root: TreeNode,
}

#[derive(Debug, Deserialize)]
struct TreeNode {
    id: String,
    title: String,
    #[serde(default)]
    children: Vec<TreeNode>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportReport {
    pub dry_run: bool,
    pub documents: usize,
    pub blocks: usize,
    pub skipped_empty: usize,
}

#[derive(Debug, Clone)]
struct ImportBlock {
    block_id: String,
    order_key: String,
    block_type: String,
    width_span: i64,
    height_mode: String,
    height_px: Option<i64>,
    content_json: String,
    plain_text: String,
    reference_id: Option<String>,
    target_block_id: Option<String>,
}

#[derive(Debug)]
struct ImportDocument {
    document_id: String,
    title: String,
    map_id: String,
    parent_id: Option<String>,
    order_key: String,
    blocks: Vec<ImportBlock>,
}

fn safe_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 80
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<T, String> {
    let text = fs::read_to_string(path)
        .map_err(|error| format!("读取 {}: {error}", path.display()))?;
    serde_json::from_str(&text)
        .map_err(|error| format!("解析 {}: {error}", path.display()))
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

fn block_comment(line: &str, prefix: &str) -> Option<String> {
    let trimmed = line.trim();
    if !trimmed.starts_with("<!--") || !trimmed.ends_with("-->") {
        return None;
    }
    let inner = trimmed
        .trim_start_matches("<!--")
        .trim_end_matches("-->")
        .trim();
    let value = inner.strip_prefix(prefix)?;
    if !safe_id(value) {
        return None;
    }
    Some(value.to_string())
}

fn embed_target(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if !trimmed.starts_with("<!--") || !trimmed.ends_with("-->") {
        return None;
    }
    let inner = trimmed
        .trim_start_matches("<!--")
        .trim_end_matches("-->")
        .trim();
    let rest = inner.strip_prefix("notes:embed=")?;
    let target = rest.split(';').next()?;
    if !safe_id(target) {
        return None;
    }
    Some(target.to_string())
}

fn kind_name(kind: BlockKind) -> &'static str {
    match kind {
        BlockKind::Heading(_) => "heading",
        BlockKind::Paragraph => "paragraph",
        BlockKind::List { .. } => "list",
        BlockKind::Quote => "quote",
        BlockKind::Code => "code",
        BlockKind::Table => "table",
        BlockKind::Rule => "rule",
    }
}

fn parse_document(
    document_id: &str,
    title: &str,
    source: &str,
) -> ImportDocument {
    let specs = split_into_blocks(source);
    let mut blocks = Vec::new();
    let mut pending_id: Option<String> = None;

    for (index, spec) in specs.iter().enumerate() {
        let raw = source[spec.range.clone()].trim();
        if raw.is_empty() {
            continue;
        }

        let mut content_lines: Vec<&str> = Vec::new();
        let mut embeds: Vec<String> = Vec::new();
        for line in raw.lines() {
            if let Some(id) = block_comment(line, "notes:block=") {
                pending_id = Some(id);
                continue;
            }
            if block_comment(line, "notes:block-end=").is_some() {
                continue;
            }
            if let Some(target) = embed_target(line) {
                embeds.push(target);
                continue;
            }
            content_lines.push(line);
        }

        let markdown = content_lines.join("\n").trim().to_string();
        if !markdown.is_empty() {
            let block_id = pending_id.take().unwrap_or_else(|| {
                format!(
                    "block_imp_{:08x}",
                    fnv(&format!("{document_id}:{index}"))
                )
            });
            let block_type = kind_name(spec.kind).to_string();
            let (width_span, height_mode, height_px) = match spec.kind {
                BlockKind::Code => (12, "auto", None),
                _ => (12, "auto", None),
            };
            let kind = match spec.kind {
                BlockKind::Heading(level) => format!("heading:{level}"),
                BlockKind::List { ordered, start } => {
                    format!("list:{ordered}:{start}")
                }
                BlockKind::Paragraph => "paragraph".into(),
                BlockKind::Quote => "quote".into(),
                BlockKind::Code => "code".into(),
                BlockKind::Table => "table".into(),
                BlockKind::Rule => "rule".into(),
            };
            let content = json!({
                "type": "rawMarkdown",
                "attrs": {
                    "markdown": markdown,
                    "kind": kind,
                }
            });
            blocks.push(ImportBlock {
                block_id,
                order_key: format!("{:08}", blocks.len()),
                block_type,
                width_span,
                height_mode: height_mode.into(),
                height_px,
                content_json: content.to_string(),
                plain_text: markdown,
                reference_id: None,
                target_block_id: None,
            });
        }

        for target in embeds {
            let block_id = format!(
                "block_imp_{:08x}",
                fnv(&format!("{document_id}:viewport:{index}:{target}"))
            );
            let reference_id = format!(
                "ref_imp_{:08x}",
                fnv(&format!("{document_id}:ref:{index}:{target}"))
            );
            blocks.push(ImportBlock {
                block_id,
                order_key: format!("{:08}", blocks.len()),
                block_type: "viewport".into(),
                width_span: 12,
                height_mode: "auto".into(),
                height_px: None,
                content_json: json!({
                    "type": "viewport",
                    "attrs": {
                        "referenceId": reference_id,
                        "targetBlockId": target
                    }
                })
                .to_string(),
                plain_text: String::new(),
                reference_id: Some(reference_id),
                target_block_id: Some(target),
            });
        }
    }

    let _ = title;
    ImportDocument {
        document_id: document_id.to_string(),
        title: title.to_string(),
        map_id: document_id
            .split_once('/')
            .map(|(map, _)| map.to_string())
            .unwrap_or_else(|| document_id.to_string()),
        parent_id: None,
        order_key: "00000000".into(),
        blocks,
    }
}

fn collect_documents(
    node: &TreeNode,
    map_id: &str,
    parent_id: Option<&str>,
    order_key: &str,
    docs_dir: &Path,
    output: &mut Vec<ImportDocument>,
    skipped_empty: &mut usize,
) -> Result<(), String> {
    if safe_id(&node.id) {
        let path = docs_dir.join(format!("{}.md", node.id));
        if path.exists() {
            let source = fs::read_to_string(&path)
                .map_err(|error| format!("读取 {}: {error}", path.display()))?;
            let document_id = format!("{map_id}/{}", node.id);
            let mut document = parse_document(&document_id, &node.title, &source);
            document.map_id = map_id.to_string();
            document.parent_id =
                parent_id.map(|parent| format!("{map_id}/{parent}"));
            document.order_key = order_key.to_string();
            if document.blocks.is_empty() {
                *skipped_empty += 1;
            } else {
                output.push(document);
            }
        }
    }
    for (index, child) in node.children.iter().enumerate() {
        collect_documents(
            child,
            map_id,
            Some(&node.id),
            &format!("{index:08}"),
            docs_dir,
            output,
            skipped_empty,
        )?;
    }
    Ok(())
}

async fn write_documents(
    connection: &mut SqliteConnection,
    documents: &[ImportDocument],
) -> Result<(), String> {
    let mut block_documents = HashMap::new();
    for document in documents {
        for block in &document.blocks {
            block_documents.insert(block.block_id.clone(), document.document_id.clone());
        }
    }

    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("开启导入事务失败: {error}"))?;
    let now = timestamp();
    for document in documents {
        sqlx::query(
            "INSERT INTO documents
             (id, title, map_id, parent_id, order_key, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
             ON CONFLICT(id) DO UPDATE SET
               title = excluded.title,
               map_id = excluded.map_id,
               parent_id = excluded.parent_id,
               order_key = excluded.order_key,
               updated_at = excluded.updated_at",
        )
        .bind(&document.document_id)
        .bind(&document.title)
        .bind(&document.map_id)
        .bind(&document.parent_id)
        .bind(&document.order_key)
        .bind(&now)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("写入文档 {} 失败: {error}", document.document_id))?;

        sqlx::query(
            "DELETE FROM block_fts
             WHERE block_id IN (SELECT id FROM blocks WHERE document_id = ?1)",
        )
        .bind(&document.document_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("清理旧 FTS 失败: {error}"))?;

        sqlx::query("DELETE FROM blocks WHERE document_id = ?1")
            .bind(&document.document_id)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("清理旧块失败: {error}"))?;

        for block in &document.blocks {
            sqlx::query(
                "INSERT INTO blocks
                 (id, document_id, type, order_key, width_span, height_mode,
                  height_px, content_json, content_schema, plain_text, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?10)",
            )
            .bind(&block.block_id)
            .bind(&document.document_id)
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
            .map_err(|error| format!("写入块 {} 失败: {error}", block.block_id))?;

            sqlx::query(
                "INSERT INTO block_fts (block_id, title, content)
                 VALUES (?1, ?2, ?3)",
            )
            .bind(&block.block_id)
            .bind(&document.title)
            .bind(&block.plain_text)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("写入 FTS {} 失败: {error}", block.block_id))?;

            if let (Some(reference_id), Some(target_block_id)) =
                (&block.reference_id, &block.target_block_id)
            {
                let target_document_id = block_documents
                    .get(target_block_id)
                    .cloned()
                    .unwrap_or_default();
                sqlx::query(
                    "INSERT OR REPLACE INTO block_references
                     (id, viewport_block_id, target_document_id, target_block_id, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                )
                .bind(reference_id)
                .bind(&block.block_id)
                .bind(target_document_id)
                .bind(target_block_id)
                .bind(&now)
                .execute(&mut *transaction)
                .await
                .map_err(|error| format!("写入引用 {} 失败: {error}", reference_id))?;
            }
        }
    }
    transaction
        .commit()
        .await
        .map_err(|error| format!("提交导入事务失败: {error}"))
}

pub async fn import_markdown_workspace(
    workspace: String,
    write: bool,
) -> Result<ImportReport, String> {
    let root = PathBuf::from(&workspace);
    let index: MapIndex = read_json(&root.join("maps.json"))?;
    let mut documents = Vec::new();
    let mut skipped_empty = 0usize;

    for map in &index.maps {
        if !safe_id(&map.id) {
            continue;
        }
        let map_dir = root.join(&map.id);
        let tree: TreeFile = read_json(&map_dir.join("tree.json"))?;
        collect_documents(
            &tree.root,
            &map.id,
            None,
            "00000000",
            &map_dir.join("docs"),
            &mut documents,
            &mut skipped_empty,
        )?;
    }

    let blocks = documents.iter().map(|document| document.blocks.len()).sum();
    if write {
        let mut connection = database::open_for_import(&workspace).await?;
        write_documents(&mut connection, &documents).await?;
    }
    Ok(ImportReport {
        dry_run: !write,
        documents: documents.len(),
        blocks,
        skipped_empty,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn imports_block_ids_and_skips_markers() {
        let source = "# 标题\n\n<!-- notes:block=block_a1b2 -->\n一段内容\n\n<!-- notes:embed=block_c3d4;span=1;height=240;zoom=1 -->\n";
        let document = parse_document("map/node", "文档", source);
        assert_eq!(document.blocks.len(), 3);
        assert_eq!(document.blocks[1].block_id, "block_a1b2");
        assert_eq!(document.blocks[1].block_type, "paragraph");
        assert_eq!(document.blocks[2].block_type, "viewport");
    }

    #[test]
    fn generates_stable_ids_for_plain_blocks() {
        let first = parse_document("map/node", "文档", "# A\n\nB");
        let second = parse_document("map/node", "文档", "# A\n\nB");
        assert_eq!(first.blocks[0].block_id, second.blocks[0].block_id);
        assert_ne!(first.blocks[0].block_id, first.blocks[1].block_id);
    }
}
