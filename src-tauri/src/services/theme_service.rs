use std::fs;
use std::path::PathBuf;

const THEMES_DIR: &str = "themes";

fn themes_dir() -> Result<PathBuf, String> {
    let executable = std::env::current_exe()
        .map_err(|error| format!("无法定位应用目录：{error}"))?;
    let app_dir = executable
        .parent()
        .ok_or_else(|| "无法定位应用目录".to_string())?;
    let dir = app_dir.join("data").join(THEMES_DIR);
    fs::create_dir_all(&dir)
        .map_err(|error| format!("无法创建主题目录：{error}"))?;
    migrate_legacy_themes(&dir);
    Ok(dir)
}

fn migrate_legacy_themes(target: &std::path::Path) {
    let Some(app_data) = std::env::var_os("APPDATA") else {
        return;
    };
    let legacy = PathBuf::from(app_data)
        .join("com.example.tauri-notes")
        .join(THEMES_DIR);
    let Ok(entries) = fs::read_dir(&legacy) else {
        return;
    };
    let mut migrated = 0usize;
    for entry in entries.flatten() {
        let source = entry.path();
        if source.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let Some(name) = source.file_name() else {
            continue;
        };
        let destination = target.join(name);
        if destination.exists() {
            continue;
        }
        if fs::copy(&source, &destination).is_ok() {
            let _ = fs::remove_file(&source);
            migrated += 1;
        }
    }
    if migrated > 0 {
        let _ = fs::remove_dir(&legacy);
    }
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
}

pub fn list() -> Result<Vec<String>, String> {
    let dir = themes_dir()?;
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

pub fn save(id: &str, json: &str) -> Result<(), String> {
    if !valid_id(id) {
        return Err("非法主题 id".to_string());
    }
    if json.is_empty() || json.len() > 64 * 1024 {
        return Err("主题内容为空或过大".to_string());
    }
    let path = themes_dir()?.join(format!("{id}.theme.json"));
    fs::write(path, json).map_err(|error| format!("保存主题失败：{error}"))
}

pub fn delete(id: &str) -> Result<(), String> {
    if !valid_id(id) {
        return Err("非法主题 id".to_string());
    }
    let path = themes_dir()?.join(format!("{id}.theme.json"));
    if path.exists() {
        fs::remove_file(path).map_err(|error| format!("删除主题失败：{error}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::valid_id;

    #[test]
    fn accepts_safe_theme_ids() {
        assert!(valid_id("ocean"));
        assert!(valid_id("my-theme-2"));
        assert!(valid_id("A1"));
    }

    #[test]
    fn rejects_path_and_empty_ids() {
        assert!(!valid_id(""));
        assert!(!valid_id("../ocean"));
        assert!(!valid_id("ocean/blue"));
        assert!(!valid_id("ocean.theme"));
        assert!(!valid_id("主题"));
        assert!(!valid_id(&"a".repeat(65)));
    }
}
