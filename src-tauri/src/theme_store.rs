use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const THEMES_DIR: &str = "themes";

fn themes_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法定位应用数据目录：{error}"))?
        .join(THEMES_DIR);
    fs::create_dir_all(&dir)
        .map_err(|error| format!("无法创建主题目录：{error}"))?;
    Ok(dir)
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
}

#[tauri::command]
pub fn list_custom_themes(app: AppHandle) -> Result<Vec<String>, String> {
    let dir = themes_dir(&app)?;
    let mut themes = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        if let Ok(text) = fs::read_to_string(&path) {
            themes.push(text);
        }
    }
    themes.sort();
    Ok(themes)
}

#[tauri::command]
pub fn save_custom_theme(
    app: AppHandle,
    id: String,
    json: String,
) -> Result<(), String> {
    if !valid_id(&id) {
        return Err("非法主题 id".to_string());
    }
    if json.is_empty() || json.len() > 64 * 1024 {
        return Err("主题内容为空或过大".to_string());
    }
    let path = themes_dir(&app)?.join(format!("{id}.theme.json"));
    fs::write(path, json).map_err(|error| format!("保存主题失败：{error}"))
}

#[tauri::command]
pub fn delete_custom_theme(app: AppHandle, id: String) -> Result<(), String> {
    if !valid_id(&id) {
        return Err("非法主题 id".to_string());
    }
    let path = themes_dir(&app)?.join(format!("{id}.theme.json"));
    if path.exists() {
        fs::remove_file(path).map_err(|error| format!("删除主题失败：{error}"))?;
    }
    Ok(())
}
