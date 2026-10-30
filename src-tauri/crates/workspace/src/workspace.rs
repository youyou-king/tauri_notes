//! Phase 1：读取现有 `.notes` 工程，只返回节点树与文档内容。
//!
//! 这一层刻意不依赖 Bevy，也不把文档全部读进内存：
//! - `open_workspace` 只读 `meta.json / maps.json / tree.json`；
//! - `read_document` 按需读取单个 `docs/<node>.md`；
//! - 后续 BlockIndex / 虚拟列表直接建立在这两个命令上。

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use tauri_notes_document::document::{BlockKind, split_into_blocks};
use tauri_notes_document::map_store;
use tauri_notes_storage::database;


const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Deserialize)]
struct WorkspaceMeta {
    schema_version: u32,
    title: String,
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
pub struct WorkspaceView {
    pub root: String,
    pub title: String,
    pub maps: Vec<MapView>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MapView {
    pub id: String,
    pub title: String,
    pub root: NodeView,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeView {
    pub id: String,
    pub title: String,
    pub has_document: bool,
    pub children: Vec<NodeView>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentView {
    pub node_id: String,
    pub path: String,
    pub content: String,
    pub modified: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockView {
    pub id: String,
    pub kind: String,
    pub text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockDocumentView {
    pub node_id: String,
    pub path: String,
    pub content: String,
    pub blocks: Vec<BlockView>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub map_id: String,
    pub map_title: String,
    pub node_id: String,
    pub node_title: String,
    pub excerpt: String,
}

fn document_path(workspace: &str, map_id: &str, node_id: &str) -> Result<PathBuf, String> {
    if !safe_id(map_id) {
        return Err(format!("非法 map id: {map_id}"));
    }
    if !safe_id(node_id) {
        return Err(format!("非法 node id: {node_id}"));
    }
    Ok(PathBuf::from(workspace)
        .join(map_id)
        .join("docs")
        .join(format!("{node_id}.md")))
}

fn block_kind_name(kind: BlockKind) -> &'static str {
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

fn block_document(path: &Path, node_id: String, content: String) -> BlockDocumentView {
    let blocks = split_into_blocks(&content)
        .into_iter()
        .enumerate()
        .map(|(index, spec)| BlockView {
            id: format!("block_{index:04}"),
            kind: block_kind_name(spec.kind).to_string(),
            text: content[spec.range].to_string(),
        })
        .collect();

    BlockDocumentView {
        node_id,
        path: path.to_string_lossy().into_owned(),
        content,
        blocks,
    }
}

fn backup_document(path: &Path, content: &str) -> Result<(), String> {
    let Some(parent) = path.parent() else {
        return Ok(());
    };
    let backup_dir = parent.join(".backup");
    fs::create_dir_all(&backup_dir)
        .map_err(|error| io_err(&format!("创建备份目录 {}", backup_dir.display()), error))?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let stem = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("node");
    let backup = backup_dir.join(format!("{stem}.{stamp}.md"));
    fs::write(&backup, content)
        .map_err(|error| io_err(&format!("写备份 {}", backup.display()), error))
}

pub(crate) fn write_atomic(path: &Path, content: &str) -> Result<(), String> {
    if path.exists() {
        let old = fs::read_to_string(path)
            .map_err(|error| io_err(&format!("读取旧版本 {}", path.display()), error))?;
        backup_document(path, &old)?;
    }

    let temp = path.with_extension("md.tmp");
    fs::write(&temp, content)
        .map_err(|error| io_err(&format!("写入临时文件 {}", temp.display()), error))?;
    tauri_notes_platform::replace_file(&temp, path).inspect_err(|_| {
        let _ = fs::remove_file(&temp);
    })?;
    invalidate_document_cache(path);
    Ok(())
}

fn io_err(context: &str, error: impl std::fmt::Display) -> String {
    format!("{context}: {error}")
}

struct CachedDocument {
    modified: u64,
    content: String,
}

fn search_cache() -> &'static Mutex<HashMap<PathBuf, CachedDocument>> {
    static CACHE: OnceLock<Mutex<HashMap<PathBuf, CachedDocument>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn invalidate_document_cache(path: &Path) {
    if let Ok(mut cache) = search_cache().lock() {
        cache.remove(path);
    }
}

fn read_cached_document(path: &Path) -> Option<String> {
    let modified = file_modified_millis(path).ok()?;
    if let Ok(cache) = search_cache().lock() {
        if let Some(cached) = cache.get(path) {
            if cached.modified == modified {
                return Some(cached.content.clone());
            }
        }
    }

    let content = fs::read_to_string(path).ok()?;
    if let Ok(mut cache) = search_cache().lock() {
        cache.insert(
            path.to_path_buf(),
            CachedDocument {
                modified,
                content: content.clone(),
            },
        );
    }
    Some(content)
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<T, String> {
    let text = fs::read_to_string(path)
        .map_err(|error| io_err(&format!("读取 {}", path.display()), error))?;
    serde_json::from_str(&text)
        .map_err(|error| io_err(&format!("解析 {}", path.display()), error))
}

/// 防止 `map id / node id` 逃出工作区目录。
fn safe_id(id: &str) -> bool {
    !id.is_empty()
        && id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
}

fn node_view(node: &TreeNode, docs_dir: &Path) -> NodeView {
    let has_document = safe_id(&node.id) && docs_dir.join(format!("{}.md", node.id)).is_file();
    NodeView {
        id: node.id.clone(),
        title: node.title.clone(),
        has_document,
        children: node
            .children
            .iter()
            .map(|child| node_view(child, docs_dir))
            .collect(),
    }
}

fn map_view(root: &Path, entry: &MapEntry) -> Result<MapView, String> {
    if !safe_id(&entry.id) {
        return Err(format!("非法 map id: {}", entry.id));
    }
    let map_dir = root.join(&entry.id);
    let tree: TreeFile = read_json(&map_dir.join("tree.json"))?;
    Ok(MapView {
        id: entry.id.clone(),
        title: entry.title.clone(),
        root: node_view(&tree.root, &map_dir.join("docs")),
    })
}

pub fn open_workspace(path: String) -> Result<WorkspaceView, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(format!("不是目录: {path}"));
    }

    let meta: WorkspaceMeta = read_json(&root.join("meta.json"))?;
    if meta.schema_version != SCHEMA_VERSION {
        return Err(format!(
            "不支持的 .notes schema_version={}（期望 {}）",
            meta.schema_version, SCHEMA_VERSION
        ));
    }

    let index: MapIndex = read_json(&root.join("maps.json"))?;
    let mut maps = Vec::with_capacity(index.maps.len());
    for entry in &index.maps {
        if !safe_id(&entry.id) || !root.join(&entry.id).join("tree.json").is_file() {
            continue;
        }
        maps.push(map_view(&root, entry)?);
    }

    Ok(WorkspaceView {
        root: root.to_string_lossy().into_owned(),
        title: meta.title,
        maps,
    })
}

fn floor_boundary(text: &str, mut index: usize) -> usize {
    while index > 0 && !text.is_char_boundary(index) {
        index -= 1;
    }
    index
}

fn make_excerpt(content: &str, lowered: &str, match_at: usize) -> String {
    let start = floor_boundary(content, match_at.saturating_sub(60));
    let end = floor_boundary(
        content,
        (match_at + 120).min(content.len().min(lowered.len())),
    );
    content[start..end]
        .replace(['\n', '\r'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn collect_search_hits(
    node: &TreeNode,
    map_id: &str,
    map_title: &str,
    docs_dir: &Path,
    query: &str,
    hits: &mut Vec<SearchHit>,
) {
    if safe_id(&node.id) {
        let path = docs_dir.join(format!("{}.md", node.id));
        if let Some(content) = read_cached_document(&path) {
            let lowered = content.to_lowercase();
            if let Some(match_at) = lowered.find(query) {
                hits.push(SearchHit {
                    map_id: map_id.to_string(),
                    map_title: map_title.to_string(),
                    node_id: node.id.clone(),
                    node_title: node.title.clone(),
                    excerpt: make_excerpt(&content, &lowered, match_at),
                });
            }
        }
    }

    for child in &node.children {
        collect_search_hits(child, map_id, map_title, docs_dir, query, hits);
    }
}

pub async fn search_blocks_db(
    workspace: String,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchHit>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let limit = limit.unwrap_or(30).clamp(1, 100) as i64;
    let mut connection = database::open_for_import(&workspace).await?;
    let tokens = query
        .split_whitespace()
        .map(|token| format!("\"{}\"*", token.replace('"', "\"\"")))
        .collect::<Vec<_>>();
    let mut hits = Vec::new();

    if !tokens.is_empty() {
        let rows = sqlx::query_as::<_, (String, String, String)>(
            "SELECT b.document_id, d.title,
                    snippet(block_fts, 2, '[', ']', '…', 12)
             FROM block_fts
             JOIN blocks b ON b.id = block_fts.block_id
             JOIN documents d ON d.id = b.document_id
             WHERE block_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2",
        )
        .bind(tokens.join(" "))
        .bind(limit)
        .fetch_all(&mut connection)
        .await
        .map_err(|error| format!("搜索失败: {error}"))?;
        hits.extend(rows.into_iter().map(|row| {
            let (map_id, node_id) = row
                .0
                .split_once('/')
                .map(|(map, node)| (map.to_string(), node.to_string()))
                .unwrap_or_else(|| (row.0.clone(), row.0));
            SearchHit {
                map_id: map_id.clone(),
                map_title: map_id,
                node_id,
                node_title: row.1,
                excerpt: row.2,
            }
        }));
    }

    if hits.is_empty() {
        let like = format!("%{query}%");
        let rows = sqlx::query_as::<_, (String, String, String)>(
            "SELECT b.document_id, d.title, substr(b.plain_text, 1, 120)
             FROM blocks b
             JOIN documents d ON d.id = b.document_id
             WHERE d.title LIKE ?1 OR b.plain_text LIKE ?1
             ORDER BY d.title, b.order_key
             LIMIT ?2",
        )
        .bind(like)
        .bind(limit)
        .fetch_all(&mut connection)
        .await
        .map_err(|error| format!("搜索失败: {error}"))?;
        hits.extend(rows.into_iter().map(|row| {
            let (map_id, node_id) = row
                .0
                .split_once('/')
                .map(|(map, node)| (map.to_string(), node.to_string()))
                .unwrap_or_else(|| (row.0.clone(), row.0));
            SearchHit {
                map_id: map_id.clone(),
                map_title: map_id,
                node_id,
                node_title: row.1,
                excerpt: row.2,
            }
        }));
    }

    Ok(hits)
}

/// Phase 4h：当前用 Rust 扫描实现；后续替换为 SQLite FTS5 + jieba。
pub fn search_workspace(
    workspace: String,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchHit>, String> {
    let root = PathBuf::from(&workspace);
    let query = query.trim().to_lowercase();
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let index: MapIndex = read_json(&root.join("maps.json"))?;
    let limit = limit.unwrap_or(30).min(100);
    let mut hits = Vec::new();

    for entry in &index.maps {
        if !safe_id(&entry.id) {
            continue;
        }
        let map_dir = root.join(&entry.id);
        let tree: TreeFile = read_json(&map_dir.join("tree.json"))?;
        collect_search_hits(
            &tree.root,
            &entry.id,
            &entry.title,
            &map_dir.join("docs"),
            &query,
            &mut hits,
        );
        if hits.len() >= limit {
            break;
        }
    }

    hits.truncate(limit);
    Ok(hits)
}

pub fn read_document(
    workspace: String,
    map_id: String,
    node_id: String,
) -> Result<DocumentView, String> {
    let path = document_path(&workspace, &map_id, &node_id)?;
    let content = fs::read_to_string(&path)
        .map_err(|error| io_err(&format!("读取 {}", path.display()), error))?;

    Ok(DocumentView {
        node_id,
        path: path.to_string_lossy().into_owned(),
        content,
        modified: file_modified_millis(&path)?,
    })
}

fn file_modified_millis(path: &Path) -> Result<u64, String> {
    let modified = fs::metadata(path)
        .and_then(|meta| meta.modified())
        .map_err(|error| io_err(&format!("读取修改时间 {}", path.display()), error))?;
    Ok(modified
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0))
}

pub fn document_modified(
    workspace: String,
    map_id: String,
    node_id: String,
) -> Result<u64, String> {
    let path = document_path(&workspace, &map_id, &node_id)?;
    file_modified_millis(&path)
}

/// Phase 2：把一篇 Markdown 切成 Block，前端只挂载可见块。
pub fn index_document(
    workspace: String,
    map_id: String,
    node_id: String,
) -> Result<BlockDocumentView, String> {
    let path = document_path(&workspace, &map_id, &node_id)?;
    let content = fs::read_to_string(&path)
        .map_err(|error| io_err(&format!("读取 {}", path.display()), error))?;

    Ok(block_document(&path, node_id, content))
}

/// Phase 3：保存单个 Block，重切块并返回新索引。
pub fn save_block(
    workspace: String,
    map_id: String,
    node_id: String,
    block_index: usize,
    text: String,
) -> Result<BlockDocumentView, String> {
    let path = document_path(&workspace, &map_id, &node_id)?;
    let content = fs::read_to_string(&path)
        .map_err(|error| io_err(&format!("读取 {}", path.display()), error))?;

    let blocks = split_into_blocks(&content);
    let Some(spec) = blocks.get(block_index) else {
        return Err(format!("块不存在: {block_index}"));
    };

    let mut updated = content.clone();
    updated.replace_range(spec.range.clone(), &text);
    write_atomic(&path, &updated)?;

    Ok(block_document(&path, node_id, updated))
}

/// 在光标处拆分一个 Block：before 留在原块，after 成为下一个块。
pub fn split_block(
    workspace: String,
    map_id: String,
    node_id: String,
    block_index: usize,
    before: String,
    after: String,
) -> Result<BlockDocumentView, String> {
    let path = document_path(&workspace, &map_id, &node_id)?;
    let content = fs::read_to_string(&path)
        .map_err(|error| io_err(&format!("读取 {}", path.display()), error))?;
    let blocks = split_into_blocks(&content);
    let Some(spec) = blocks.get(block_index) else {
        return Err(format!("块不存在: {block_index}"));
    };

    let replacement = if after.is_empty() {
        before
    } else if before.is_empty() {
        after
    } else {
        format!("{before}\n\n{after}")
    };
    let mut updated = content.clone();
    updated.replace_range(spec.range.clone(), &replacement);
    write_atomic(&path, &updated)?;
    Ok(block_document(&path, node_id, updated))
}

/// 用一段文本替换连续块区间，用于连续文本段落编辑。
pub fn save_block_range(
    workspace: String,
    map_id: String,
    node_id: String,
    start_index: usize,
    end_index: usize,
    text: String,
) -> Result<BlockDocumentView, String> {
    let path = document_path(&workspace, &map_id, &node_id)?;
    let content = fs::read_to_string(&path)
        .map_err(|error| io_err(&format!("读取 {}", path.display()), error))?;
    let blocks = split_into_blocks(&content);
    let (Some(start), Some(end)) = (blocks.get(start_index), blocks.get(end_index)) else {
        return Err(format!("块区间不存在: {start_index}..={end_index}"));
    };
    if start_index > end_index {
        return Err("块区间起点大于终点".to_string());
    }

    let mut updated = content.clone();
    updated.replace_range(start.range.start..end.range.end, &text);
    write_atomic(&path, &updated)?;
    Ok(block_document(&path, node_id, updated))
}

/// 把当前块合并到上一块（Backspace 到行首）。
pub fn merge_blocks(
    workspace: String,
    map_id: String,
    node_id: String,
    block_index: usize,
    current_text: String,
) -> Result<BlockDocumentView, String> {
    if block_index == 0 {
        return Err("第一块没有上一块".to_string());
    }
    let path = document_path(&workspace, &map_id, &node_id)?;
    let content = fs::read_to_string(&path)
        .map_err(|error| io_err(&format!("读取 {}", path.display()), error))?;
    let blocks = split_into_blocks(&content);
    let (Some(previous), Some(current)) =
        (blocks.get(block_index - 1), blocks.get(block_index))
    else {
        return Err(format!("块不存在: {block_index}"));
    };

    let previous_text = &content[previous.range.clone()];
    let merged = if current_text.is_empty() {
        previous_text.to_string()
    } else if previous_text.is_empty() {
        current_text
    } else {
        format!("{previous_text}\n{current_text}")
    };

    let mut updated = content.clone();
    updated.replace_range(previous.range.start..current.range.end, &merged);
    write_atomic(&path, &updated)?;
    Ok(block_document(&path, node_id, updated))
}

/// 整篇回写：用于撤销/重做或跨块操作。
pub fn write_document(
    workspace: String,
    map_id: String,
    node_id: String,
    content: String,
) -> Result<BlockDocumentView, String> {
    let path = document_path(&workspace, &map_id, &node_id)?;
    write_atomic(&path, &content)?;
    Ok(block_document(&path, node_id, content))
}

fn block_texts(content: &str) -> Vec<String> {
    split_into_blocks(content)
        .into_iter()
        .map(|spec| content[spec.range].to_string())
        .collect()
}

/// 删除选中的 Block。为了保持 Markdown 结构，按块文本重新拼接。
pub fn delete_blocks(
    workspace: String,
    map_id: String,
    node_id: String,
    block_indices: Vec<usize>,
) -> Result<BlockDocumentView, String> {
    let path = document_path(&workspace, &map_id, &node_id)?;
    let content = fs::read_to_string(&path)
        .map_err(|error| io_err(&format!("读取 {}", path.display()), error))?;
    let texts = block_texts(&content);

    if block_indices.iter().any(|index| *index >= texts.len()) {
        return Err("删除的块不存在".to_string());
    }

    let mut remove = block_indices;
    remove.sort_unstable();
    remove.dedup();
    let kept: Vec<String> = texts
        .into_iter()
        .enumerate()
        .filter(|(index, _)| !remove.contains(index))
        .map(|(_, text)| text)
        .collect();
    let updated = kept.join("\n\n");

    write_atomic(&path, &updated)?;
    Ok(block_document(&path, node_id, updated))
}

/// 在块边界插入 Markdown。粘贴可能包含多个块，重新切块后返回新索引。
pub fn insert_blocks(
    workspace: String,
    map_id: String,
    node_id: String,
    at_index: usize,
    markdown: String,
) -> Result<BlockDocumentView, String> {
    let path = document_path(&workspace, &map_id, &node_id)?;
    let content = fs::read_to_string(&path)
        .map_err(|error| io_err(&format!("读取 {}", path.display()), error))?;
    let mut texts = block_texts(&content);
    let at = at_index.min(texts.len());
    let pasted = markdown.trim_end().to_string();
    if pasted.is_empty() {
        return Ok(block_document(&path, node_id, content));
    }
    texts.insert(at, pasted);
    let updated = texts.join("\n\n");

    write_atomic(&path, &updated)?;
    Ok(block_document(&path, node_id, updated))
}

pub async fn create_note_file(path: String, title: String) -> Result<WorkspaceView, String> {
    let path_ref = Path::new(&path);
    if path_ref.exists() {
        if !path_ref.is_file() {
            return Err("目标路径不是文件，无法替换".into());
        }
        fs::remove_file(path_ref)
            .map_err(|error| io_err(&format!("替换 {}", path_ref.display()), error))?;
        for suffix in ["-wal", "-shm"] {
            let sidecar = format!("{}{}", path_ref.display(), suffix);
            let _ = fs::remove_file(sidecar);
        }
    }
    if let Some(parent) = path_ref.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| io_err(&format!("创建目录 {}", parent.display()), error))?;
    }
    let title = title.trim();
    if title.is_empty() {
        return Err("知识库标题不能为空".into());
    }
    let mut connection = database::open_for_import(&path).await?;
    let map_id = format!(
        "map_{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default()
    );
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_default();
    sqlx::query("INSERT INTO maps (id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)")
        .bind(&map_id)
        .bind(title)
        .bind(&now)
        .execute(&mut connection)
        .await
        .map_err(|error| format!("创建默认导图失败: {error}"))?;
    drop(connection);
    open_note_workspace(path).await
}

pub async fn open_note_workspace(path: String) -> Result<WorkspaceView, String> {
    let path_ref = Path::new(&path);
    if !path_ref.is_file() {
        return Err(format!("不是 .note 文件: {path}"));
    }
    let rows = {
        let mut connection = database::open_for_import(&path).await?;
        sqlx::query_as::<_, (String, String)>(
            "SELECT id, title FROM maps ORDER BY created_at, id",
        )
        .fetch_all(&mut connection)
        .await
        .map_err(|error| format!("读取导图失败: {error}"))?
    };
    if rows.is_empty() {
        return Err("知识库里没有导图".into());
    }
    let mut maps = Vec::with_capacity(rows.len());
    for (map_id, map_title) in rows {
        let mind = map_store::load_mind_map(path.clone(), map_id.clone()).await?;
        fn to_node(node: map_store::MapNodeView) -> NodeView {
            NodeView {
                id: node.id,
                title: node.title,
                has_document: node.has_document,
                children: node.children.into_iter().map(to_node).collect(),
            }
        }
        maps.push(MapView {
            id: map_id,
            title: map_title.clone(),
            root: NodeView {
                id: "root".to_string(),
                title: map_title,
                has_document: false,
                children: mind
                    .root
                    .children
                    .into_iter()
                    .map(to_node)
                    .collect(),
            },
        });
    }
    Ok(WorkspaceView {
        root: path.clone(),
        title: path_ref
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or("知识库")
            .to_string(),
        maps,
    })
}

pub async fn save_note_file(path: String) -> Result<String, String> {
    let path_ref = Path::new(&path);
    if !path_ref.is_file() {
        return Err(format!("不是 .note 文件: {path}"));
    }
    {
        let mut connection = database::open_for_import(&path).await?;
        sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)")
            .execute(&mut connection)
            .await
            .map_err(|error| format!("checkpoint 失败: {error}"))?;
    }
    let file_name = path_ref
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("notes.note");
    let backup = path_ref.with_file_name(format!("{file_name}.bak"));
    fs::copy(path_ref, &backup)
        .map_err(|error| io_err(&format!("备份 {}", backup.display()), error))?;
    Ok(backup.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::{
        delete_blocks, index_document, insert_blocks, open_note_workspace, open_workspace,
        read_document, safe_id, save_block, search_workspace, write_document,
    };
    use std::fs;
    use std::path::PathBuf;

    fn block_on<F: std::future::Future>(future: F) -> F::Output {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("runtime")
            .block_on(future)
    }

    #[test]
    fn ids_cannot_escape_workspace() {
        assert!(safe_id("node_001"));
        assert!(safe_id("map-001"));
        assert!(!safe_id("../meta"));
        assert!(!safe_id("a/b"));
        assert!(!safe_id(r"a\b"));
        assert!(!safe_id(""));
    }

    #[test]
    fn opens_help_note_fixture() {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("..")
            .join("help.note");
        let view = block_on(open_note_workspace(
            path.to_string_lossy().into_owned(),
        ))
        .expect("help.note should open");
        assert_eq!(view.maps.len(), 1);
        assert_eq!(view.maps[0].title, "使用帮助");
        assert!(!view.maps[0].root.children.is_empty());
    }

    #[test]
    fn opens_tree_and_reads_document() {
        let root = std::env::temp_dir().join(format!("tauri-notes-test-{}", std::process::id()));
        let map = root.join("map_001");
        let docs = map.join("docs");
        fs::create_dir_all(&docs).unwrap();

        fs::write(
            root.join("meta.json"),
            r#"{"schema_version":1,"title":"测试知识库","created_at":0}"#,
        )
        .unwrap();
        fs::write(
            root.join("maps.json"),
            r#"{"maps":[{"id":"map_001","title":"测试导图"}]}"#,
        )
        .unwrap();
        fs::write(
            map.join("tree.json"),
            r#"{"root":{"id":"node_001","title":"根节点","children":[{"id":"node_002","title":"子节点","children":[]}]}}"#,
        )
        .unwrap();
        fs::write(docs.join("node_001.md"), "# 根节点\n\n正文").unwrap();

        let view = open_workspace(root.to_string_lossy().into_owned()).unwrap();
        assert_eq!(view.title, "测试知识库");
        assert_eq!(view.maps.len(), 1);
        assert_eq!(view.maps[0].root.children.len(), 1);
        assert!(view.maps[0].root.has_document);
        assert!(!view.maps[0].root.children[0].has_document);

        let hits = search_workspace(view.root.clone(), "正文".to_string(), None).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].node_id, "node_001");
        assert!(hits[0].excerpt.contains("正文"));

        let document = read_document(
            view.root.clone(),
            "map_001".to_string(),
            "node_001".to_string(),
        )
        .unwrap();
        assert_eq!(document.content, "# 根节点\n\n正文");
        assert_eq!(document.node_id, "node_001");

        let indexed = index_document(
            view.root.clone(),
            "map_001".to_string(),
            "node_001".to_string(),
        )
        .unwrap();
        assert_eq!(indexed.blocks.len(), 2);
        assert_eq!(indexed.blocks[0].kind, "heading");
        assert_eq!(indexed.blocks[0].text, "# 根节点");
        assert_eq!(indexed.blocks[1].kind, "paragraph");
        assert_eq!(indexed.blocks[1].text, "正文");

        let saved = save_block(
            view.root.clone(),
            "map_001".to_string(),
            "node_001".to_string(),
            1,
            "修改后的正文".to_string(),
        )
        .unwrap();
        assert_eq!(saved.blocks[1].text, "修改后的正文");
        assert_eq!(
            std::fs::read_to_string(docs.join("node_001.md")).unwrap(),
            "# 根节点\n\n修改后的正文"
        );
        let backups: Vec<_> = std::fs::read_dir(docs.join(".backup"))
            .unwrap()
            .collect();
        assert_eq!(backups.len(), 1);

        // 整篇回写用于撤销：恢复旧内容。
        let restored = write_document(
            view.root.clone(),
            "map_001".to_string(),
            "node_001".to_string(),
            "# 根节点\n\n正文".to_string(),
        )
        .unwrap();
        assert_eq!(restored.blocks[1].text, "正文");

        let deleted = delete_blocks(
            view.root.clone(),
            "map_001".to_string(),
            "node_001".to_string(),
            vec![1],
        )
        .unwrap();
        assert_eq!(deleted.content, "# 根节点");

        let inserted = insert_blocks(
            view.root.clone(),
            "map_001".to_string(),
            "node_001".to_string(),
            1,
            "粘贴的正文".to_string(),
        )
        .unwrap();
        assert_eq!(inserted.content, "# 根节点\n\n粘贴的正文");

        fs::remove_dir_all(PathBuf::from(&view.root)).unwrap();
    }
}
