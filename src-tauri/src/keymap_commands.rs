use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use toml_edit::{value, ArrayOfTables, Document, Item, Table};

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KeymapBinding {
    pub action: String,
    pub platform: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub surface: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
    #[serde(default)]
    pub ctrl: bool,
    #[serde(default)]
    pub meta: bool,
    #[serde(default)]
    pub alt: bool,
    #[serde(default)]
    pub shift: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KeymapFile {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub bindings: Vec<KeymapBinding>,
}

fn default_version() -> u32 {
    2
}

impl Default for KeymapFile {
    fn default() -> Self {
        Self {
            version: default_version(),
            bindings: Vec::new(),
        }
    }
}

fn keymap_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("无法解析配置目录: {error}"))?;
    Ok(directory.join("keymap.toml"))
}

fn validate_keymap(keymap: &KeymapFile) -> Result<(), String> {
    if keymap.version == 0 {
        return Err("keymap.version 必须大于 0".into());
    }
    for (index, binding) in keymap.bindings.iter().enumerate() {
        if binding.action.trim().is_empty() {
            return Err(format!("bindings[{index}].action 不能为空"));
        }
        if !matches!(binding.platform.as_str(), "desktop" | "mac" | "mobile") {
            return Err(format!(
                "bindings[{index}].platform 必须是 desktop/mac/mobile"
            ));
        }
        let has_key = binding
            .key
            .as_deref()
            .is_some_and(|key| !key.trim().is_empty())
            || binding
                .code
                .as_deref()
                .is_some_and(|code| !code.trim().is_empty());
        let has_surface = binding
            .surface
            .as_deref()
            .is_some_and(|surface| !surface.trim().is_empty());
        if has_key == has_surface {
            return Err(format!(
                "bindings[{index}] 必须且只能提供 key/code 或 surface"
            ));
        }
        if binding.platform != "mobile" && !has_key {
            return Err(format!(
                "bindings[{index}] 的桌面绑定必须提供 key 或 code"
            ));
        }
    }
    Ok(())
}

fn read_keymap(path: &PathBuf) -> Result<KeymapFile, String> {
    if !path.is_file() {
        return Ok(KeymapFile::default());
    }
    let text = fs::read_to_string(path)
        .map_err(|error| format!("读取 keymap 失败: {error}"))?;
    let parsed: KeymapFile =
        toml::from_str(&text).map_err(|error| format!("解析 keymap 失败: {error}"))?;
    validate_keymap(&parsed)?;
    Ok(parsed)
}

fn table_string<'a>(table: &'a Table, key: &str) -> Option<&'a str> {
    table.get(key).and_then(Item::as_str)
}

fn binding_matches(table: &Table, binding: &KeymapBinding) -> bool {
    if table_string(table, "action") != Some(binding.action.as_str())
        || table_string(table, "platform") != Some(binding.platform.as_str())
    {
        return false;
    }
    if binding.surface.is_some() || table_string(table, "surface").is_some() {
        return table_string(table, "surface") == binding.surface.as_deref();
    }
    if let Some(code) = binding.code.as_deref() {
        if let Some(existing) = table_string(table, "code") {
            return existing == code;
        }
    }
    true
}

fn set_optional(table: &mut Table, key: &str, text: Option<&str>) {
    match text {
        Some(text) if table_string(table, key) == Some(text) => {}
        Some(text) => {
            table[key] = value(text);
        }
        None => {
            table.remove(key);
        }
    }
}

fn set_flag(table: &mut Table, key: &str, flag: bool) {
    if table.get(key).and_then(Item::as_bool) == Some(flag) {
        return;
    }
    if flag {
        table[key] = value(true);
    } else {
        table.remove(key);
    }
}

fn merge_keymap(existing: Option<&str>, keymap: &KeymapFile) -> Result<String, String> {
    validate_keymap(keymap)?;
    let mut document = existing
        .and_then(|text| text.parse::<Document>().ok())
        .unwrap_or_else(Document::new);
    document["version"] = value(i64::from(keymap.version));
    let previous: Vec<Table> = document
        .get("bindings")
        .and_then(Item::as_array_of_tables)
        .map(|tables| tables.iter().cloned().collect())
        .unwrap_or_default();
    let mut next = ArrayOfTables::new();
    for binding in &keymap.bindings {
        let mut table = previous
            .iter()
            .find(|table| binding_matches(table, binding))
            .cloned()
            .unwrap_or_default();
        table["action"] = value(binding.action.as_str());
        table["platform"] = value(binding.platform.as_str());
        set_optional(&mut table, "key", binding.key.as_deref());
        set_optional(&mut table, "code", binding.code.as_deref());
        set_optional(&mut table, "surface", binding.surface.as_deref());
        set_optional(&mut table, "scope", binding.scope.as_deref());
        set_flag(&mut table, "ctrl", binding.ctrl);
        set_flag(&mut table, "meta", binding.meta);
        set_flag(&mut table, "alt", binding.alt);
        set_flag(&mut table, "shift", binding.shift);
        next.push(table);
    }
    document["bindings"] = Item::ArrayOfTables(next);
    Ok(document.to_string())
}

fn write_keymap(path: &PathBuf, keymap: &KeymapFile) -> Result<(), String> {
    validate_keymap(keymap)?;
    if let Some(directory) = path.parent() {
        fs::create_dir_all(directory)
            .map_err(|error| format!("创建配置目录失败: {error}"))?;
    }
    let existing = fs::read_to_string(path).ok();
    let text = merge_keymap(existing.as_deref(), keymap)?;
    fs::write(path, text).map_err(|error| format!("写入 keymap 失败: {error}"))
}

#[tauri::command]
pub fn load_keymap(app: AppHandle) -> Result<KeymapFile, String> {
    read_keymap(&keymap_path(&app)?)
}

#[tauri::command]
pub fn save_keymap(app: AppHandle, keymap: KeymapFile) -> Result<(), String> {
    write_keymap(&keymap_path(&app)?, &keymap)
}

#[tauri::command]
pub fn export_keymap(path: String, keymap: KeymapFile) -> Result<(), String> {
    write_keymap(&PathBuf::from(path), &keymap)
}

#[tauri::command]
pub fn import_keymap(path: String) -> Result<KeymapFile, String> {
    read_keymap(&PathBuf::from(path))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_bindings_and_defaults_booleans() {
        let text = r#"
version = 2

[[bindings]]
action = "search.open"
platform = "desktop"
key = "p"
ctrl = true

[[bindings]]
action = "search.open"
platform = "mobile"
surface = "search.open"
"#;
        let parsed: KeymapFile = toml::from_str(text).expect("valid keymap");
        assert_eq!(parsed.version, 2);
        assert_eq!(parsed.bindings.len(), 2);
        assert!(parsed.bindings[0].ctrl);
        assert!(!parsed.bindings[0].meta);
        assert_eq!(parsed.bindings[1].surface.as_deref(), Some("search.open"));
    }

    #[test]
    fn rejects_binding_with_key_and_surface() {
        let keymap = KeymapFile {
            version: 2,
            bindings: vec![KeymapBinding {
                action: "search.open".into(),
                platform: "mobile".into(),
                key: Some("p".into()),
                surface: Some("search.open".into()),
                ..Default::default()
            }],
        };
        assert!(validate_keymap(&keymap).is_err());
    }

    #[test]
    fn serializes_to_toml() {
        let keymap = KeymapFile {
            version: 2,
            bindings: vec![KeymapBinding {
                action: "settings.open".into(),
                platform: "desktop".into(),
                key: Some(",".into()),
                ctrl: true,
                ..Default::default()
            }],
        };
        let text = toml::to_string_pretty(&keymap).expect("serialize");
        assert!(text.contains("[[bindings]]"));
        assert!(text.contains("action = \"settings.open\""));
    }

    #[test]
    fn preserves_comments_when_rewriting_an_existing_binding() {
        let existing = r#"# user keymap
version = 1

[[bindings]]
action = "search.open"
# keep this comment
platform = "desktop"
key = "p"
ctrl = true
"#;
        let keymap = KeymapFile {
            version: 2,
            bindings: vec![KeymapBinding {
                action: "search.open".into(),
                platform: "desktop".into(),
                key: Some("k".into()),
                ctrl: true,
                ..Default::default()
            }],
        };
        let rendered = merge_keymap(Some(existing), &keymap).expect("merge");
        assert!(rendered.contains("# user keymap"));
        assert!(rendered.contains("# keep this comment"));
        assert!(rendered.contains("key = \"k\""));
    }
}