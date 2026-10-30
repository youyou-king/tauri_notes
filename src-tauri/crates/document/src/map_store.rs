use std::collections::HashMap;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sqlx::Connection;

use tauri_notes_storage::database;
use crate::document_store;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MapNodeView {
    pub id: String,
    pub title: String,
    pub has_document: bool,
    pub document_id: Option<String>,
    pub heading_block_id: Option<String>,
    pub position_x: f64,
    pub position_y: f64,
    pub children: Vec<MapNodeView>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MindMapView {
    pub id: String,
    pub title: String,
    pub root: MapNodeView,
}

#[derive(Debug, Deserialize)]
struct MapIndex {
    maps: Vec<MapEntry>,
}

#[derive(Debug, Deserialize)]
struct MapEntry {
    id: String,
    title: String,
}

#[derive(Debug, Clone)]
struct NodeRow {
    id: String,
    title: String,
    document_id: Option<String>,
    heading_block_id: Option<String>,
    position_x: f64,
    position_y: f64,
}

fn now() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_default()
}

fn stamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos().to_string())
        .unwrap_or_default()
}

fn is_note_path(workspace: &str) -> bool {
    Path::new(workspace)
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("note"))
}

fn map_title(workspace: &str, map_id: &str) -> String {
    if is_note_path(workspace) {
        return Path::new(workspace)
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or(map_id)
            .to_string();
    }
    let path = Path::new(workspace).join("maps.json");
    if let Ok(text) = std::fs::read_to_string(path) {
        if let Ok(index) = serde_json::from_str::<MapIndex>(&text) {
            if let Some(entry) = index.maps.into_iter().find(|entry| entry.id == map_id) {
                return entry.title;
            }
        }
    }
    map_id.to_string()
}

async fn ensure_map(
    connection: &mut sqlx::SqliteConnection,
    workspace: &str,
    map_id: &str,
) -> Result<String, String> {
    let existing: Option<String> =
        sqlx::query_scalar("SELECT title FROM maps WHERE id = ?1")
            .bind(map_id)
            .fetch_optional(&mut *connection)
            .await
            .map_err(|error| format!("读取导图失败: {error}"))?;
    if let Some(title) = existing {
        return Ok(title);
    }
    let title = map_title(workspace, map_id);
    let now = now();
    sqlx::query(
        "INSERT INTO maps (id, title, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?3)",
    )
    .bind(map_id)
    .bind(&title)
    .bind(&now)
    .execute(&mut *connection)
    .await
    .map_err(|error| format!("创建导图失败: {error}"))?;
    Ok(title)
}

fn map_root_id(map_id: &str) -> String {
    format!("map:{map_id}")
}

async fn ensure_map_root(
    connection: &mut sqlx::SqliteConnection,
    map_id: &str,
) -> Result<String, String> {
    let (title, document_id) = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT title, document_id FROM maps WHERE id = ?1",
    )
    .bind(map_id)
    .fetch_optional(&mut *connection)
    .await
    .map_err(|error| format!("读取导图根节点失败: {error}"))?
    .ok_or_else(|| "导图不存在".to_string())?;
    let root_id = map_root_id(map_id);
    let timestamp = now();

    sqlx::query(
        "INSERT INTO map_nodes
         (id, map_id, parent_id, title, document_id, heading_block_id, origin,
          position_x, position_y, order_key, created_at, updated_at)
         VALUES (?1, ?2, NULL, ?3, ?4, NULL, 'document', 0, 0, '00000000', ?5, ?5)
         ON CONFLICT(id) DO UPDATE SET
           map_id = excluded.map_id,
           parent_id = NULL,
           title = excluded.title,
           document_id = excluded.document_id,
           heading_block_id = NULL,
           origin = 'document',
           updated_at = excluded.updated_at",
    )
    .bind(&root_id)
    .bind(map_id)
    .bind(&title)
    .bind(&document_id)
    .bind(&timestamp)
    .execute(&mut *connection)
    .await
    .map_err(|error| format!("创建导图根节点失败: {error}"))?;

    // Older versions stored document roots as parentless document nodes. Move
    // their children under the canonical root before removing the duplicate.
    if let Some(root_document) = document_id {
        sqlx::query(
            "UPDATE map_nodes SET parent_id = ?1
             WHERE parent_id IN (
               SELECT id FROM map_nodes
               WHERE map_id = ?2 AND parent_id IS NULL
                 AND document_id = ?3 AND id <> ?1
             )",
        )
        .bind(&root_id)
        .bind(map_id)
        .bind(&root_document)
        .execute(&mut *connection)
        .await
        .map_err(|error| format!("迁移旧根节点子节点失败: {error}"))?;
        sqlx::query(
            "DELETE FROM map_nodes
             WHERE map_id = ?1 AND parent_id IS NULL
               AND document_id = ?2 AND id <> ?3",
        )
        .bind(map_id)
        .bind(&root_document)
        .bind(&root_id)
        .execute(&mut *connection)
        .await
        .map_err(|error| format!("清理旧根节点失败: {error}"))?;
    }

    sqlx::query(
        "UPDATE map_nodes SET parent_id = ?1
         WHERE map_id = ?2 AND id <> ?1 AND parent_id IS NULL",
    )
    .bind(&root_id)
    .bind(map_id)
    .execute(&mut *connection)
    .await
    .map_err(|error| format!("迁移根级节点失败: {error}"))?;

    Ok(root_id)
}

async fn seed_document_nodes(
    connection: &mut sqlx::SqliteConnection,
    map_id: &str,
) -> Result<(), String> {
    let root_id = ensure_map_root(connection, map_id).await?;
    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM map_nodes WHERE map_id = ?1 AND id <> ?2")
            .bind(map_id)
            .bind(&root_id)
            .fetch_one(&mut *connection)
            .await
            .map_err(|error| format!("统计导图节点失败: {error}"))?;
    if count > 0 {
        return Ok(());
    }
    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT id, title FROM documents
         WHERE map_id = ?1
           AND id NOT IN (
             SELECT document_id FROM maps
             WHERE id = ?1 AND document_id IS NOT NULL
           )
         ORDER BY title",
    )
    .bind(map_id)
    .fetch_all(&mut *connection)
    .await
    .map_err(|error| format!("读取文档节点失败: {error}"))?;
    let now = now();
    for (index, (document_id, title)) in rows.into_iter().enumerate() {
        let node_id = format!("node_{}", document_id.replace(['/', '-'], "_"));
        sqlx::query(
            "INSERT OR IGNORE INTO map_nodes
             (id, map_id, parent_id, title, document_id, heading_block_id, origin,
              position_x, position_y, order_key, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, NULL, 'document', ?6, 0, ?7, ?8, ?8)",
        )
        .bind(&node_id)
        .bind(map_id)
        .bind(&root_id)
        .bind(&title)
        .bind(&document_id)
        .bind(0.0)
        .bind(format!("{index:08}"))
        .bind(&now)
        .execute(&mut *connection)
        .await
        .map_err(|error| format!("创建文档节点失败: {error}"))?;
    }
    Ok(())
}

fn heading_level(block_type: &str, content_json: &str, plain_text: &str) -> usize {
    if block_type != "heading" {
        return 0;
    }
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

fn heading_title(plain_text: &str) -> String {
    plain_text.trim_start_matches('#').trim().to_string()
}

pub async fn sync_document_headings(workspace: &str, document_id: &str) -> Result<(), String> {
    let mut connection = database::open_for_import(workspace).await?;
    let parents = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT id, map_id, title, origin FROM map_nodes WHERE document_id = ?1",
    )
    .bind(document_id)
    .fetch_all(&mut connection)
    .await
    .map_err(|error| format!("读取文档对应节点失败: {error}"))?;
    if parents.is_empty() {
        return Ok(());
    }

    let blocks = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT id, type, content_json, plain_text
         FROM blocks WHERE document_id = ?1 ORDER BY order_key",
    )
    .bind(document_id)
    .fetch_all(&mut connection)
    .await
    .map_err(|error| format!("读取文档标题失败: {error}"))?;
    let headings = blocks
        .into_iter()
        .filter_map(|(block_id, block_type, content_json, plain_text)| {
            if heading_level(&block_type, &content_json, &plain_text) == 1 {
                Some((block_id, heading_title(&plain_text)))
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    for (parent_id, _, parent_title, parent_origin) in parents {
        let effective_headings = headings
            .iter()
            .filter(|(_, title)| {
                !(parent_origin == "document" && title == &parent_title)
            })
            .collect::<Vec<_>>();
        let existing = sqlx::query_as::<_, (String, String, Option<String>, Option<String>)>(
            "SELECT id, title, heading_block_id, document_id FROM map_nodes
             WHERE parent_id = ?1 AND heading_block_id IS NOT NULL",
        )
        .bind(&parent_id)
        .fetch_all(&mut connection)
        .await
        .map_err(|error| format!("读取自动节点失败: {error}"))?;
        let mut by_heading = HashMap::new();
        for (node_id, title, heading_block_id, document_id) in existing {
            if let Some(heading_block_id) = heading_block_id {
                by_heading.insert(heading_block_id, (node_id, title, document_id));
            }
        }

        for (index, (block_id, title)) in effective_headings.iter().enumerate() {
            if let Some((node_id, old_title, document_id)) = by_heading.remove(block_id) {
                if old_title != *title {
                    let updated = now();
                    sqlx::query("UPDATE map_nodes SET title = ?1, updated_at = ?2 WHERE id = ?3")
                        .bind(title)
                        .bind(&updated)
                        .bind(&node_id)
                        .execute(&mut connection)
                        .await
                        .map_err(|error| format!("更新自动节点失败: {error}"))?;
                    if let Some(document_id) = document_id {
                        sqlx::query(
                            "UPDATE documents SET title = ?1, updated_at = ?2 WHERE id = ?3",
                        )
                        .bind(title)
                        .bind(&updated)
                        .bind(&document_id)
                        .execute(&mut connection)
                        .await
                        .map_err(|error| format!("同步子文档标题失败: {error}"))?;
                    }
                }
                continue;
            }
            let node_id = format!("hnode_{}_{}", parent_id, block_id);
            sqlx::query(
                "INSERT OR IGNORE INTO map_nodes
                 (id, map_id, parent_id, title, document_id, heading_block_id, origin,
                  position_x, position_y, order_key, created_at, updated_at)
                 SELECT ?1, map_id, ?2, ?3, NULL, ?4, 'heading', 0, 0, ?5, ?6, ?6
                 FROM map_nodes WHERE id = ?2",
            )
            .bind(&node_id)
            .bind(&parent_id)
            .bind(title)
            .bind(block_id)
            .bind(format!("{index:08}"))
            .bind(now())
            .execute(&mut connection)
            .await
            .map_err(|error| format!("创建自动节点失败: {error}"))?;
        }

        for (_, (node_id, _, _)) in by_heading {
            let has_document: Option<String> =
                sqlx::query_scalar("SELECT document_id FROM map_nodes WHERE id = ?1")
                    .bind(&node_id)
                    .fetch_one(&mut connection)
                    .await
                    .map_err(|error| format!("读取自动节点失败: {error}"))?;
            if has_document.is_some() {
                sqlx::query(
                    "UPDATE map_nodes SET origin = 'manual', heading_block_id = NULL,
                     updated_at = ?1 WHERE id = ?2",
                )
                .bind(now())
                .bind(&node_id)
                .execute(&mut connection)
                .await
                .map_err(|error| format!("保留已建文档节点失败: {error}"))?;
            } else {
                sqlx::query("DELETE FROM map_nodes WHERE id = ?1")
                    .bind(&node_id)
                    .execute(&mut connection)
                    .await
                    .map_err(|error| format!("删除过期自动节点失败: {error}"))?;
            }
        }
    }
    Ok(())
}

fn build_children(
    parent: Option<String>,
    grouped: &HashMap<Option<String>, Vec<NodeRow>>,
    visited: &mut std::collections::HashSet<String>,
) -> Vec<MapNodeView> {
    let mut result = Vec::new();
    if let Some(rows) = grouped.get(&parent) {
        for row in rows {
            if !visited.insert(row.id.clone()) {
                continue;
            }
            result.push(MapNodeView {
                id: row.id.clone(),
                title: row.title.clone(),
                has_document: row.document_id.is_some(),
                document_id: row.document_id.clone(),
                heading_block_id: row.heading_block_id.clone(),
                position_x: row.position_x,
                position_y: row.position_y,
                children: build_children(Some(row.id.clone()), grouped, visited),
            });
        }
    }
    result
}

pub async fn load_mind_map(workspace: String, map_id: String) -> Result<MindMapView, String> {
    let mut connection = database::open_for_import(&workspace).await?;
    let title = ensure_map(&mut connection, &workspace, &map_id).await?;
    let root_id = ensure_map_root(&mut connection, &map_id).await?;
    seed_document_nodes(&mut connection, &map_id).await?;

    let document_ids = sqlx::query_scalar::<_, String>(
        "SELECT document_id FROM map_nodes WHERE map_id = ?1 AND document_id IS NOT NULL",
    )
    .bind(&map_id)
    .fetch_all(&mut connection)
    .await
    .map_err(|error| format!("读取导图文档失败: {error}"))?;
    for document_id in document_ids {
        sync_document_headings(&workspace, &document_id).await?;
    }

    let rows = sqlx::query_as::<_, (String, Option<String>, String, Option<String>, Option<String>, f64, f64)>(
        "SELECT id, parent_id, title, document_id, heading_block_id, position_x, position_y
         FROM map_nodes WHERE map_id = ?1 ORDER BY order_key, id",
    )
    .bind(&map_id)
    .fetch_all(&mut connection)
    .await
    .map_err(|error| format!("读取导图节点失败: {error}"))?;
    let root_row = rows.iter().find(|row| row.0 == root_id).cloned();
    let mut grouped: HashMap<Option<String>, Vec<NodeRow>> = HashMap::new();
    for row in rows {
        let parent = row.1.clone();
        grouped.entry(parent).or_default().push(NodeRow {
            id: row.0,
            title: row.2,
            document_id: row.3,
            heading_block_id: row.4,
            position_x: row.5,
            position_y: row.6,
        });
    }
    let mut visited = std::collections::HashSet::new();
    let children = build_children(Some(root_id.clone()), &grouped, &mut visited);
    let root_document = root_row.as_ref().and_then(|row| row.3.clone());
    let root_title = root_row
        .as_ref()
        .map(|row| row.2.clone())
        .unwrap_or(title);
    let root_heading = root_row.as_ref().and_then(|row| row.4.clone());
    let root_x = root_row.as_ref().map(|row| row.5).unwrap_or(0.0);
    let root_y = root_row.as_ref().map(|row| row.6).unwrap_or(0.0);

    Ok(MindMapView {
        id: map_id.clone(),
        title: root_title.clone(),
        root: MapNodeView {
            id: root_id,
            title: root_title,
            has_document: root_document.is_some(),
            document_id: root_document,
            heading_block_id: root_heading,
            position_x: root_x,
            position_y: root_y,
            children,
        },
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlineDocument {
    pub document_id: String,
    pub title: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlineView {
    pub title: String,
    pub maps: Vec<MindMapView>,
    pub unfiled: Vec<OutlineDocument>,
}

#[derive(Debug, Deserialize)]
struct WorkspaceMeta {
    title: String,
}

pub async fn load_outline(workspace: String) -> Result<OutlineView, String> {
    let root = Path::new(&workspace);
    let note = is_note_path(&workspace);
    let title = if note {
        root.file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or("知识库")
            .to_string()
    } else {
        std::fs::read_to_string(root.join("meta.json"))
            .ok()
            .and_then(|text| serde_json::from_str::<WorkspaceMeta>(&text).ok())
            .map(|meta| meta.title)
            .unwrap_or_else(|| {
                root.file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("知识库")
                    .to_string()
            })
    };

    let mut connection = database::open_for_import(&workspace).await?;
    let entries = if note {
        let mut rows = sqlx::query_as::<_, (String, String)>(
            "SELECT id, title FROM maps ORDER BY created_at, id",
        )
        .fetch_all(&mut connection)
        .await
        .map_err(|error| format!("读取导图失败: {error}"))?;
        if rows.is_empty() {
            let map_id = format!("map_{}", stamp());
            let now = now();
            sqlx::query(
                "INSERT INTO maps (id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
            )
            .bind(&map_id)
            .bind(&title)
            .bind(&now)
            .execute(&mut connection)
            .await
            .map_err(|error| format!("创建默认导图失败: {error}"))?;
            rows.push((map_id, title.clone()));
        }
        rows
    } else {
        let index = std::fs::read_to_string(root.join("maps.json"))
            .ok()
            .and_then(|text| serde_json::from_str::<MapIndex>(&text).ok());
        let entries = index
            .map(|index| index.maps)
            .unwrap_or_default()
            .into_iter()
            .filter(|entry| {
                !entry.id.is_empty()
                    && entry
                        .id
                        .chars()
                        .all(|character| character.is_ascii_alphanumeric() || character == '_' || character == '-')
                    && root.join(&entry.id).join("tree.json").is_file()
            })
            .collect::<Vec<_>>();
        for entry in &entries {
            ensure_map(&mut connection, &workspace, &entry.id).await?;
        }
        let known = sqlx::query_scalar::<_, String>("SELECT id FROM maps")
            .fetch_all(&mut connection)
            .await
            .map_err(|error| format!("读取导图列表失败: {error}"))?;
        for id in known {
            if !entries.iter().any(|entry| entry.id == id) {
                sqlx::query("DELETE FROM maps WHERE id = ?1")
                    .bind(&id)
                    .execute(&mut connection)
                    .await
                    .map_err(|error| format!("清理失效导图失败: {error}"))?;
            }
        }
        entries
            .into_iter()
            .map(|entry| (entry.id, entry.title))
            .collect()
    };
    for entry in &entries {
        seed_document_nodes(&mut connection, &entry.0).await?;
    }
    let document_ids = sqlx::query_scalar::<_, String>(
        "SELECT document_id FROM map_nodes WHERE document_id IS NOT NULL",
    )
    .fetch_all(&mut connection)
    .await
    .map_err(|error| format!("读取导图文档失败: {error}"))?;
    for document_id in document_ids {
        sync_document_headings(&workspace, &document_id).await?;
    }
    sqlx::query(
        "UPDATE documents SET map_id = NULL
         WHERE id NOT IN (
           SELECT document_id FROM map_nodes WHERE document_id IS NOT NULL
         )",
    )
    .execute(&mut connection)
    .await
    .map_err(|error| format!("整理未归类文档失败: {error}"))?;
    let unfiled = sqlx::query_as::<_, (String, String)>(
        "SELECT id, title FROM documents WHERE map_id IS NULL ORDER BY title",
    )
    .fetch_all(&mut connection)
    .await
    .map_err(|error| format!("读取未归类文档失败: {error}"))?
    .into_iter()
    .map(|(document_id, title)| OutlineDocument { document_id, title })
    .collect::<Vec<_>>();
    drop(connection);

    let mut maps = Vec::with_capacity(entries.len());
    for entry in entries {
        maps.push(load_mind_map(workspace.clone(), entry.0).await?);
    }
    Ok(OutlineView {
        title,
        maps,
        unfiled,
    })
}

pub async fn create_mind_map(workspace: String, title: String) -> Result<String, String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("导图名称不能为空".into());
    }
    let mut connection = database::open_for_import(&workspace).await?;
    let map_id = format!("map_{}", stamp());
    let now = now();
    sqlx::query(
        "INSERT INTO maps (id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
    )
    .bind(&map_id)
    .bind(title)
    .bind(&now)
    .execute(&mut connection)
    .await
    .map_err(|error| format!("创建导图失败: {error}"))?;
    ensure_map_root(&mut connection, &map_id).await?;
    sync_maps_json(&workspace, &mut connection).await?;
    Ok(map_id)
}

pub async fn rename_mind_map(
    workspace: String,
    map_id: String,
    title: String,
) -> Result<(), String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("导图名称不能为空".into());
    }
    let mut connection = database::open_for_import(&workspace).await?;
    let result = sqlx::query("UPDATE maps SET title = ?1, updated_at = ?2 WHERE id = ?3")
        .bind(title)
        .bind(now())
        .bind(&map_id)
        .execute(&mut connection)
        .await
        .map_err(|error| format!("重命名导图失败: {error}"))?;
    if result.rows_affected() == 0 {
        return Err("导图不存在".into());
    }
    sqlx::query(
        "UPDATE documents SET title = ?1, updated_at = ?2
         WHERE id = (SELECT document_id FROM maps WHERE id = ?3)",
    )
    .bind(title)
    .bind(now())
    .bind(&map_id)
    .execute(&mut connection)
    .await
    .map_err(|error| format!("同步根文档标题失败: {error}"))?;
    sqlx::query("UPDATE map_nodes SET title = ?1, updated_at = ?2 WHERE id = ?3")
        .bind(title)
        .bind(now())
        .bind(map_root_id(&map_id))
        .execute(&mut connection)
        .await
        .map_err(|error| format!("同步根节点标题失败: {error}"))?;
    sync_maps_json(&workspace, &mut connection).await?;
    Ok(())
}

pub async fn delete_map_node(workspace: String, node_id: String) -> Result<(), String> {
    let mut connection = database::open_for_import(&workspace).await?;
    let exists: Option<String> =
        sqlx::query_scalar("SELECT map_id FROM map_nodes WHERE id = ?1")
            .bind(&node_id)
            .fetch_optional(&mut connection)
            .await
            .map_err(|error| format!("读取节点失败: {error}"))?;
    let Some(map_id) = exists else {
        return Err("节点不存在".into());
    };
    let ids = sqlx::query_scalar::<_, String>(
        "WITH RECURSIVE subtree(id) AS (
            SELECT id FROM map_nodes WHERE id = ?1 AND map_id = ?2
            UNION ALL
            SELECT n.id FROM map_nodes n
            JOIN subtree s ON n.parent_id = s.id
            WHERE n.map_id = ?2
         )
         SELECT id FROM subtree",
    )
    .bind(&node_id)
    .bind(&map_id)
    .fetch_all(&mut connection)
    .await
    .map_err(|error| format!("读取节点子树失败: {error}"))?;
    if ids.is_empty() {
        return Ok(());
    }
    let placeholders = vec!["?"; ids.len()].join(", ");
    let updated_at = now();
    let move_sql = format!(
        "UPDATE documents SET map_id = NULL, updated_at = ?1
         WHERE id IN (SELECT document_id FROM map_nodes
                      WHERE id IN ({placeholders}) AND document_id IS NOT NULL)"
    );
    let mut move_documents = sqlx::query(&move_sql).bind(&updated_at);
    for id in &ids {
        move_documents = move_documents.bind(id);
    }
    move_documents
        .execute(&mut connection)
        .await
        .map_err(|error| format!("移动节点文档到未归类失败: {error}"))?;
    let delete_sql = format!("DELETE FROM map_nodes WHERE id IN ({placeholders})");
    let mut delete_nodes = sqlx::query(&delete_sql);
    for id in &ids {
        delete_nodes = delete_nodes.bind(id);
    }
    delete_nodes
        .execute(&mut connection)
        .await
        .map_err(|error| format!("删除节点失败: {error}"))?;
    Ok(())
}

pub async fn delete_mind_map(workspace: String, map_id: String) -> Result<(), String> {
    let mut connection = database::open_for_import(&workspace).await?;
    sqlx::query("UPDATE documents SET map_id = NULL WHERE map_id = ?1")
        .bind(&map_id)
        .execute(&mut connection)
        .await
        .map_err(|error| format!("移动文档到未归类失败: {error}"))?;
    sqlx::query("DELETE FROM maps WHERE id = ?1")
        .bind(&map_id)
        .execute(&mut connection)
        .await
        .map_err(|error| format!("删除导图失败: {error}"))?;
    sync_maps_json(&workspace, &mut connection).await?;
    Ok(())
}

async fn sync_maps_json(
    workspace: &str,
    connection: &mut sqlx::SqliteConnection,
) -> Result<(), String> {
    if is_note_path(workspace) {
        return Ok(());
    }
    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT id, title FROM maps ORDER BY created_at, id",
    )
    .fetch_all(&mut *connection)
    .await
    .map_err(|error| format!("读取导图列表失败: {error}"))?;
    let maps = rows
        .into_iter()
        .map(|(id, title)| serde_json::json!({ "id": id, "title": title }))
        .collect::<Vec<_>>();
    let value = serde_json::json!({ "maps": maps });
    let path = Path::new(workspace).join("maps.json");
    std::fs::write(
        path,
        serde_json::to_string_pretty(&value).unwrap_or_default(),
    )
    .map_err(|error| format!("写入导图索引失败: {error}"))
}

pub async fn create_map_node(
    workspace: String,
    map_id: String,
    parent_id: Option<String>,
    title: String,
) -> Result<String, String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("节点标题不能为空".into());
    }
    let mut connection = database::open_for_import(&workspace).await?;
    ensure_map(&mut connection, &workspace, &map_id).await?;
    ensure_map_root(&mut connection, &map_id).await?;
    let parent_id = parent_id.unwrap_or_else(|| map_root_id(&map_id));
    let exists: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM map_nodes WHERE id = ?1 AND map_id = ?2")
            .bind(&parent_id)
            .bind(&map_id)
            .fetch_one(&mut connection)
            .await
            .map_err(|error| format!("校验父节点失败: {error}"))?;
    if exists == 0 {
        return Err("父节点不存在".into());
    }
    let node_id = format!("mnode_{}", stamp());
    let now = now();
    sqlx::query(
        "INSERT INTO map_nodes
         (id, map_id, parent_id, title, document_id, heading_block_id, origin,
          position_x, position_y, order_key, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, NULL, NULL, 'manual', 0, 0, ?5, ?6, ?6)",
    )
    .bind(&node_id)
    .bind(&map_id)
    .bind(&parent_id)
    .bind(title)
    .bind(format!("{:020}", stamp()))
    .bind(&now)
    .execute(&mut connection)
    .await
    .map_err(|error| format!("创建节点失败: {error}"))?;
    Ok(node_id)
}

pub async fn rename_map_node(
    workspace: String,
    node_id: String,
    title: String,
) -> Result<(), String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("节点标题不能为空".into());
    }
    let mut connection = database::open_for_import(&workspace).await?;
    let node = sqlx::query_as::<_, (Option<String>, Option<String>, Option<String>)>(
        "SELECT document_id, heading_block_id, parent_id FROM map_nodes WHERE id = ?1",
    )
    .bind(&node_id)
    .fetch_optional(&mut connection)
    .await
    .map_err(|error| format!("读取节点失败: {error}"))?
    .ok_or_else(|| "节点不存在".to_string())?;
    let document_id = node.0;
    let now = now();
    sqlx::query("UPDATE map_nodes SET title = ?1, updated_at = ?2 WHERE id = ?3")
        .bind(title)
        .bind(&now)
        .bind(&node_id)
        .execute(&mut connection)
        .await
        .map_err(|error| format!("更新节点失败: {error}"))?;
    if let Some(document_id) = document_id {
        sqlx::query("UPDATE documents SET title = ?1, updated_at = ?2 WHERE id = ?3")
            .bind(title)
            .bind(&now)
            .bind(&document_id)
            .execute(&mut connection)
            .await
            .map_err(|error| format!("同步文档标题失败: {error}"))?;
    }
    let map_id: Option<String> =
        sqlx::query_scalar("SELECT map_id FROM map_nodes WHERE id = ?1")
            .bind(&node_id)
            .fetch_optional(&mut connection)
            .await
            .map_err(|error| format!("读取节点导图失败: {error}"))?
            .flatten();
    if let Some(map_id) = map_id {
        if node_id == map_root_id(&map_id) {
            sqlx::query("UPDATE maps SET title = ?1, updated_at = ?2 WHERE id = ?3")
                .bind(title)
                .bind(&now)
                .bind(&map_id)
                .execute(&mut connection)
                .await
                .map_err(|error| format!("同步导图标题失败: {error}"))?;
        }
    }
    if let (Some(heading_block_id), Some(parent_id)) = (node.1, node.2) {
        let parent_document: Option<String> =
            sqlx::query_scalar("SELECT document_id FROM map_nodes WHERE id = ?1")
                .bind(&parent_id)
                .fetch_optional(&mut connection)
                .await
                .map_err(|error| format!("读取父节点文档失败: {error}"))?
                .flatten();
        if let Some(parent_document) = parent_document {
            let block = sqlx::query_as::<_, (String, String)>(
                "SELECT type, content_json FROM blocks WHERE id = ?1 AND document_id = ?2",
            )
            .bind(&heading_block_id)
            .bind(&parent_document)
            .fetch_optional(&mut connection)
            .await
            .map_err(|error| format!("读取标题块失败: {error}"))?;
            if let Some((block_type, content_json)) = block {
                let markdown = format!("# {title}");
                let mut value: serde_json::Value = serde_json::from_str(&content_json)
                    .unwrap_or_else(|_| serde_json::json!({}));
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
                    value["content"] =
                        serde_json::json!([{ "type": "text", "text": title }]);
                }
                sqlx::query(
                    "UPDATE blocks SET content_json = ?1, plain_text = ?2, updated_at = ?3
                     WHERE id = ?4",
                )
                .bind(value.to_string())
                .bind(&markdown)
                .bind(&now)
                .bind(&heading_block_id)
                .execute(&mut connection)
                .await
                .map_err(|error| format!("同步标题块失败: {error}"))?;
                sqlx::query("UPDATE block_fts SET content = ?1 WHERE block_id = ?2")
                    .bind(&markdown)
                    .bind(&heading_block_id)
                    .execute(&mut connection)
                    .await
                    .map_err(|error| format!("同步标题索引失败: {error}"))?;
            }
        }
    }
    Ok(())
}

pub async fn set_map_node_position(
    workspace: String,
    node_id: String,
    x: f64,
    y: f64,
) -> Result<(), String> {
    let mut connection = database::open_for_import(&workspace).await?;
    sqlx::query("UPDATE map_nodes SET position_x = ?1, position_y = ?2, updated_at = ?3 WHERE id = ?4")
        .bind(x)
        .bind(y)
        .bind(now())
        .bind(&node_id)
        .execute(&mut connection)
        .await
        .map_err(|error| format!("保存节点位置失败: {error}"))?;
    Ok(())
}

pub async fn bind_document_to_map_node(
    workspace: String,
    node_id: String,
    document_id: String,
) -> Result<(), String> {
    let mut connection = database::open_for_import(&workspace).await?;
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("开启绑定事务失败: {error}"))?;
    let node = sqlx::query_as::<_, (String, String, Option<String>, Option<String>)>(
        "SELECT map_id, title, document_id, heading_block_id FROM map_nodes WHERE id = ?1",
    )
    .bind(&node_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("读取目标节点失败: {error}"))?
    .ok_or_else(|| "目标节点不存在".to_string())?;
    let source_title: String = sqlx::query_scalar("SELECT title FROM documents WHERE id = ?1")
        .bind(&document_id)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|error| format!("读取源文档失败: {error}"))?
        .ok_or_else(|| "源文档不存在".to_string())?;
    let now = now();

    if let Some(target_document_id) = node.2.clone() {
        if target_document_id == document_id {
            return Ok(());
        }
        let max_order: Option<String> =
            sqlx::query_scalar("SELECT MAX(order_key) FROM blocks WHERE document_id = ?1")
                .bind(&target_document_id)
                .fetch_one(&mut *transaction)
                .await
                .map_err(|error| format!("读取目标块顺序失败: {error}"))?;
        let mut next_order = max_order
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(0);
        let blocks = sqlx::query_as::<_, (String, String, Option<String>, String)>(
            "SELECT id, type, content_json, plain_text
             FROM blocks WHERE document_id = ?1 ORDER BY order_key",
        )
        .bind(&document_id)
        .fetch_all(&mut *transaction)
        .await
        .map_err(|error| format!("读取源文档块失败: {error}"))?;
        for (block_id, block_type, content_json, plain_text) in blocks {
            let content_json = content_json.unwrap_or_default();
            if heading_level(&block_type, &content_json, &plain_text) == 1
                && heading_title(&plain_text) == source_title
            {
                sqlx::query("DELETE FROM block_fts WHERE block_id = ?1")
                    .bind(&block_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|error| format!("删除源标题索引失败: {error}"))?;
                continue;
            }
            next_order += 1;
            sqlx::query(
                "UPDATE blocks SET document_id = ?1, order_key = ?2, updated_at = ?3
                 WHERE id = ?4",
            )
            .bind(&target_document_id)
            .bind(format!("{next_order:08}"))
            .bind(&now)
            .bind(&block_id)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("追加块失败: {error}"))?;
            sqlx::query("UPDATE block_fts SET title = ?1 WHERE block_id = ?2")
                .bind(&node.1)
                .bind(&block_id)
                .execute(&mut *transaction)
                .await
                .map_err(|error| format!("更新块索引失败: {error}"))?;
        }
        sqlx::query("UPDATE assets SET document_id = ?1 WHERE document_id = ?2")
            .bind(&target_document_id)
            .bind(&document_id)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("迁移图片失败: {error}"))?;
        sqlx::query("DELETE FROM documents WHERE id = ?1")
            .bind(&document_id)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("删除源文档失败: {error}"))?;
        sqlx::query("UPDATE documents SET title = ?1, updated_at = ?2 WHERE id = ?3")
            .bind(&node.1)
            .bind(&now)
            .bind(&target_document_id)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("更新目标文档失败: {error}"))?;
    } else {
        sqlx::query(
            "UPDATE map_nodes SET document_id = ?1, title = ?2, origin = 'document',
             updated_at = ?3 WHERE id = ?4",
        )
        .bind(&document_id)
        .bind(&node.1)
        .bind(&now)
        .bind(&node_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("绑定节点失败: {error}"))?;
        sqlx::query(
            "UPDATE documents SET map_id = ?1, title = ?2, updated_at = ?3 WHERE id = ?4",
        )
        .bind(&node.0)
        .bind(&node.1)
        .bind(&now)
        .bind(&document_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("更新文档失败: {error}"))?;
    }

    transaction
        .commit()
        .await
        .map_err(|error| format!("提交绑定事务失败: {error}"))?;
    Ok(())
}

pub async fn create_document_for_map_root(
    workspace: String,
    map_id: String,
) -> Result<String, String> {
    let mut connection = database::open_for_import(&workspace).await?;
    let row = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT title, document_id FROM maps WHERE id = ?1",
    )
    .bind(&map_id)
    .fetch_optional(&mut connection)
    .await
    .map_err(|error| format!("读取导图失败: {error}"))?
    .ok_or_else(|| "导图不存在".to_string())?;
    if let Some(document_id) = row.1 {
        return Ok(document_id);
    }
    let created = document_store::create_imported_document(
        workspace.clone(),
        map_id.clone(),
        row.0,
    )
    .await?;
    sqlx::query("UPDATE maps SET document_id = ?1, updated_at = ?2 WHERE id = ?3")
        .bind(&created.id)
        .bind(now())
        .bind(&map_id)
        .execute(&mut connection)
        .await
        .map_err(|error| format!("绑定根节点文档失败: {error}"))?;
    ensure_map_root(&mut connection, &map_id).await?;
    sync_document_headings(&workspace, &created.id).await?;
    Ok(created.id)
}

pub async fn create_document_for_map_node(
    workspace: String,
    node_id: String,
) -> Result<MapNodeView, String> {
    let mut connection = database::open_for_import(&workspace).await?;
    let row = sqlx::query_as::<_, (String, String, Option<String>, Option<String>)>(
        "SELECT map_id, title, document_id, heading_block_id FROM map_nodes WHERE id = ?1",
    )
    .bind(&node_id)
    .fetch_optional(&mut connection)
    .await
    .map_err(|error| format!("读取节点失败: {error}"))?
    .ok_or_else(|| "节点不存在".to_string())?;

    let document_id = if let Some(document_id) = row.2.clone() {
        document_id
    } else {
        let created =
            document_store::create_imported_document(workspace.clone(), row.0.clone(), row.1.clone())
                .await?;
        sqlx::query(
            "UPDATE map_nodes SET document_id = ?1, origin = 'document', updated_at = ?2
             WHERE id = ?3",
        )
        .bind(&created.id)
        .bind(now())
        .bind(&node_id)
        .execute(&mut connection)
        .await
        .map_err(|error| format!("绑定文档失败: {error}"))?;
        created.id
    };

    if node_id == map_root_id(&row.0) {
        sqlx::query("UPDATE maps SET document_id = ?1, updated_at = ?2 WHERE id = ?3")
            .bind(&document_id)
            .bind(now())
            .bind(&row.0)
            .execute(&mut connection)
            .await
            .map_err(|error| format!("绑定根节点文档失败: {error}"))?;
        ensure_map_root(&mut connection, &row.0).await?;
        sync_document_headings(&workspace, &document_id).await?;
    }

    Ok(MapNodeView {
        id: node_id,
        title: row.1,
        has_document: true,
        document_id: Some(document_id),
        heading_block_id: row.3,
        position_x: 0.0,
        position_y: 0.0,
        children: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::{ensure_map_root, map_root_id, sync_document_headings};

    fn block_on<F: std::future::Future>(future: F) -> F::Output {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("runtime")
            .block_on(future)
    }
    use tauri_notes_storage::database;
    use std::fs;

    #[test]
    fn root_document_h1_creates_child_nodes() {
        let root = std::env::temp_dir().join(format!(
            "tauri-notes-map-root-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let path = root.join("root.note");
        let workspace = path.to_string_lossy().into_owned();
        let map_id = "map_root_test";
        let document_id = "map_root_test/root_doc";

        block_on(async {
            let mut connection = database::open_for_import(&workspace).await.unwrap();
            sqlx::query(
                "INSERT INTO maps (id, title, created_at, updated_at, document_id)
                 VALUES (?1, '根导图', '1', '1', ?2)",
            )
            .bind(map_id)
            .bind(document_id)
            .execute(&mut connection)
            .await
            .unwrap();
            sqlx::query(
                "INSERT INTO documents (id, title, created_at, updated_at, map_id, parent_id, order_key)
                 VALUES (?1, '根导图', '1', '1', ?2, NULL, '00000000')",
            )
            .bind(document_id)
            .bind(map_id)
            .execute(&mut connection)
            .await
            .unwrap();
            sqlx::query(
                "INSERT INTO blocks (id, document_id, type, order_key, width_span, height_mode,
                  height_px, content_json, content_schema, plain_text, updated_at)
                 VALUES (?1, ?2, 'heading', '00000000', 12, 'auto', NULL, ?3, 1, '子标题', '1')",
            )
            .bind("block_root_h1")
            .bind(document_id)
            .bind(r#"{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"子标题"}]}"#)
            .execute(&mut connection)
            .await
            .unwrap();
            ensure_map_root(&mut connection, map_id).await.unwrap();
        });

        block_on(sync_document_headings(&workspace, document_id)).unwrap();

        block_on(async {
            let mut connection = database::open_for_import(&workspace).await.unwrap();
            let child: Option<String> = sqlx::query_scalar(
                "SELECT heading_block_id FROM map_nodes
                 WHERE map_id = ?1 AND parent_id = ?2 AND heading_block_id IS NOT NULL",
            )
            .bind(map_id)
            .bind(map_root_id(map_id))
            .fetch_optional(&mut connection)
            .await
            .unwrap();
            assert_eq!(child.as_deref(), Some("block_root_h1"));
        });

        let _ = fs::remove_dir_all(root);
    }
}
