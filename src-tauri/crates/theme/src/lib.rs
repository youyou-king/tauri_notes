use std::fs;
use std::path::PathBuf;

use tauri_notes_platform::{NativePlatform, PlatformAdapter};

const THEMES_DIR: &str = "themes";

fn themes_dir() -> Result<PathBuf, String> {
    let dir = NativePlatform::new().data_dir()?.join(THEMES_DIR);
    fs::create_dir_all(&dir)
        .map_err(|error| format!("无法创建主题目录：{error}"))?;
    migrate_legacy_themes(&dir);
    Ok(dir)
}

fn migrate_legacy_themes(target: &std::path::Path) {
    let Some(legacy) = NativePlatform::new().legacy_theme_dir() else {
        return;
    };
    migrate_themes_from(target, &legacy);
}

fn migrate_themes_from(
    target: &std::path::Path,
    legacy: &std::path::Path,
) {
    let Ok(entries) = fs::read_dir(legacy) else {
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
        let _ = fs::remove_dir(legacy);
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
    use super::{migrate_themes_from, valid_id};
    use std::fs;
    use std::path::PathBuf;

    fn temp_root(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "tauri-notes-theme-{name}-{}",
            std::process::id()
        ))
    }

    #[test]
    fn migrates_json_themes_and_skips_others() {
        let root = temp_root("migrate");
        let target = root.join("target");
        let legacy = root.join("legacy");
        fs::create_dir_all(&target).unwrap();
        fs::create_dir_all(&legacy).unwrap();
        fs::write(legacy.join("ocean.theme.json"), "{\"id\":\"ocean\"}")
            .unwrap();
        fs::write(legacy.join("notes.txt"), "keep").unwrap();

        migrate_themes_from(&target, &legacy);

        assert_eq!(
            fs::read_to_string(target.join("ocean.theme.json")).unwrap(),
            "{\"id\":\"ocean\"}"
        );
        assert!(!legacy.join("ocean.theme.json").exists());
        assert!(legacy.join("notes.txt").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn does_not_overwrite_existing_theme() {
        let root = temp_root("existing");
        let target = root.join("target");
        let legacy = root.join("legacy");
        fs::create_dir_all(&target).unwrap();
        fs::create_dir_all(&legacy).unwrap();
        fs::write(target.join("ocean.theme.json"), "old").unwrap();
        fs::write(legacy.join("ocean.theme.json"), "new").unwrap();

        migrate_themes_from(&target, &legacy);

        assert_eq!(
            fs::read_to_string(target.join("ocean.theme.json")).unwrap(),
            "old"
        );
        assert!(legacy.join("ocean.theme.json").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn ignores_missing_legacy_directory() {
        let root = temp_root("missing");
        let target = root.join("target");
        fs::create_dir_all(&target).unwrap();
        migrate_themes_from(&target, &root.join("missing"));
        fs::remove_dir_all(root).unwrap();
    }

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
