use std::fs;
use std::path::PathBuf;

const THEMES_DIR: &str = "themes";

/// Theme storage rooted at an injected data directory.
pub struct ThemeStore {
    data_dir: PathBuf,
}

impl ThemeStore {
    pub fn new(data_dir: PathBuf) -> Self {
        Self { data_dir }
    }

    fn themes_dir(&self) -> Result<PathBuf, String> {
        let dir = self.data_dir.join(THEMES_DIR);
        fs::create_dir_all(&dir).map_err(|error| format!("无法创建主题目录：{error}"))?;
        Ok(dir)
    }

    pub fn list(&self) -> Result<Vec<String>, String> {
        let dir = self.themes_dir()?;
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

    pub fn save(&self, id: &str, json: &str) -> Result<(), String> {
        if !valid_id(id) {
            return Err("非法主题 id".to_string());
        }
        if json.is_empty() || json.len() > 64 * 1024 {
            return Err("主题内容为空或过大".to_string());
        }
        let path = self.themes_dir()?.join(format!("{id}.theme.json"));
        fs::write(path, json).map_err(|error| format!("保存主题失败：{error}"))
    }

    pub fn delete(&self, id: &str) -> Result<(), String> {
        if !valid_id(id) {
            return Err("非法主题 id".to_string());
        }
        let path = self.themes_dir()?.join(format!("{id}.theme.json"));
        if path.exists() {
            fs::remove_file(path).map_err(|error| format!("删除主题失败：{error}"))?;
        }
        Ok(())
    }
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
}

#[cfg(test)]
mod tests {
    use super::{valid_id, ThemeStore};
    use std::fs;
    use std::path::PathBuf;

    fn temp_root(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("tauri-notes-theme-{name}-{}", std::process::id()))
    }

    #[test]
    fn store_reads_saves_and_deletes_from_injected_directory() {
        let root = temp_root("store");
        let store = ThemeStore::new(root.join("data"));
        store.save("ocean", "{\"id\":\"ocean\"}").unwrap();
        assert_eq!(store.list().unwrap().len(), 1);
        store.delete("ocean").unwrap();
        assert!(store.list().unwrap().is_empty());
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
    }
}
