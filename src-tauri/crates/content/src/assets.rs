use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

fn fnv(value: &str) -> u32 {
    let mut hash = 2166136261u32;
    for byte in value.as_bytes() {
        hash ^= u32::from(*byte);
        hash = hash.wrapping_mul(16777619);
    }
    hash
}

fn safe_segment(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
                character
            } else {
                '_'
            }
        })
        .collect()
}

use tauri_notes_storage::database;

fn mime_for(extension: &str) -> &'static str {
    match extension.to_ascii_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "avif" => "image/avif",
        _ => "application/octet-stream",
    }
}

pub async fn save_note_image_asset(
    workspace: String,
    document_id: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    if bytes.is_empty() {
        return Err("图片内容为空".into());
    }
    if bytes.len() > 25 * 1024 * 1024 {
        return Err("图片超过 25MB".into());
    }
    let extension = Path::new(&file_name)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .ok_or_else(|| "图片没有扩展名".to_string())?;
    if !matches!(
        extension.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "avif"
    ) {
        return Err(format!("不支持的图片格式: {extension}"));
    }
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let digest = fnv(&format!("{file_name}:{stamp}:{}", bytes.len()));
    let id = format!("asset_{stamp:x}_{digest:08x}");
    let relative = format!("assets/{id}.{extension}");
    let mut connection = database::open_for_import(&workspace).await?;
    sqlx::query(
        "INSERT INTO assets
         (id, document_id, path, mime, width, height, created_at, data)
         VALUES (?1, ?2, ?3, ?4, NULL, NULL, ?5, ?6)",
    )
    .bind(&id)
    .bind(&document_id)
    .bind(&relative)
    .bind(mime_for(&extension))
    .bind(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs().to_string())
            .unwrap_or_default(),
    )
    .bind(bytes)
    .execute(&mut connection)
    .await
    .map_err(|error| format!("保存图片失败: {error}"))?;
    Ok(relative)
}

pub fn save_image_asset(
    workspace: String,
    document_id: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    if bytes.is_empty() {
        return Err("图片内容为空".into());
    }
    if bytes.len() > 25 * 1024 * 1024 {
        return Err("图片超过 25MB".into());
    }
    let extension = Path::new(&file_name)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .ok_or_else(|| "图片没有扩展名".to_string())?;
    if !matches!(
        extension.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "avif"
    ) {
        return Err(format!("不支持的图片格式: {extension}"));
    }
    let map_id = document_id
        .split('/')
        .next()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "无效的文档 ID".to_string())?;
    let assets_dir = PathBuf::from(&workspace)
        .join(safe_segment(map_id))
        .join("docs")
        .join("assets");
    fs::create_dir_all(&assets_dir)
        .map_err(|error| format!("创建 assets 目录失败: {error}"))?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let digest = fnv(&format!("{file_name}:{stamp}:{}", bytes.len()));
    let stored_name = format!("image_{stamp:x}_{digest:08x}.{extension}");
    fs::write(assets_dir.join(&stored_name), bytes)
        .map_err(|error| format!("写入图片失败: {error}"))?;
    Ok(format!("assets/{stored_name}"))
}

pub fn copy_image_asset(
    workspace: String,
    document_id: String,
    source_path: String,
) -> Result<String, String> {
    let source = Path::new(&source_path);
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .ok_or_else(|| "图片没有扩展名".to_string())?;
    if !matches!(
        extension.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "avif"
    ) {
        return Err(format!("不支持的图片格式: {extension}"));
    }
    if !source.is_file() {
        return Err(format!("图片不存在: {}", source.display()));
    }

    let map_id = document_id
        .split('/')
        .next()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "无效的文档 ID".to_string())?;
    let assets_dir = PathBuf::from(&workspace)
        .join(safe_segment(map_id))
        .join("docs")
        .join("assets");
    fs::create_dir_all(&assets_dir)
        .map_err(|error| format!("创建 assets 目录失败: {error}"))?;

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let digest = fnv(&format!("{}:{}", source_path, stamp));
    let file_name = format!("image_{stamp:x}_{digest:08x}.{extension}");
    let destination = assets_dir.join(&file_name);
    fs::copy(source, &destination)
        .map_err(|error| format!("复制图片失败: {error}"))?;

    Ok(format!("assets/{file_name}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_asset_names_and_mime_types() {
        assert_eq!(mime_for("PNG"), "image/png");
        assert_eq!(mime_for("jpg"), "image/jpeg");
        assert_eq!(safe_segment("a b/图.png"), "a_b___png");
    }

    #[test]
    fn copies_image_into_document_assets() {
        let workspace = std::env::temp_dir().join(format!(
            "tauri-notes-assets-{}",
            std::process::id()
        ));
        let source = workspace.join("source.png");
        fs::create_dir_all(&workspace).expect("workspace");
        fs::write(&source, [0x89, b'P', b'N', b'G']).expect("source");

        let relative = copy_image_asset(
            workspace.to_string_lossy().to_string(),
            "map_001/node_001".into(),
            source.to_string_lossy().to_string(),
        )
        .expect("copy");

        assert!(relative.starts_with("assets/image_"));
        assert!(relative.ends_with(".png"));
        let copied = workspace
            .join("map_001")
            .join("docs")
            .join(&relative);
        assert!(copied.is_file());
        assert_eq!(fs::read(copied).expect("bytes"), vec![0x89, b'P', b'N', b'G']);

        fs::remove_dir_all(workspace).ok();
    }
}

