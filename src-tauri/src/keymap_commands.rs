use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

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

fn write_keymap(path: &PathBuf, keymap: &KeymapFile) -> Result<(), String> {
    validate_keymap(keymap)?;
    if let Some(directory) = path.parent() {
        fs::create_dir_all(directory)
            .map_err(|error| format!("创建配置目录失败: {error}"))?;
    }
    let text = toml::to_string_pretty(keymap)
        .map_err(|error| format!("序列化 keymap 失败: {error}"))?;
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
}