//! 版本号同步：以 package.json 为准，检查或更新其他三处。

use std::fs;
use std::path::{Path, PathBuf};

use crate::{project_root, Result};

/// 参与版本同步的四个文件。
struct Files {
    package: PathBuf,
    tauri: PathBuf,
    cargo: PathBuf,
    lock: PathBuf,
}

impl Files {
    fn discover() -> Self {
        let root = project_root();
        Self {
            package: root.join("package.json"),
            tauri: root.join("src-tauri").join("tauri.conf.json"),
            cargo: root.join("src-tauri").join("Cargo.toml"),
            lock: root.join("src-tauri").join("Cargo.lock"),
        }
    }
}

/// 读取四处版本号并检查是否一致。
pub fn check() -> Result<()> {
    let files = Files::discover();
    let package = read_json_version(&files.package)?;
    let tauri = read_json_version(&files.tauri)?;
    let cargo = read_cargo_version(&files.cargo)?;
    let lock = read_cargo_version(&files.lock)?;

    let mut mismatches = Vec::new();
    for (label, path, value) in [
        ("tauri.conf.json", &files.tauri, &tauri),
        ("Cargo.toml", &files.cargo, &cargo),
        ("Cargo.lock", &files.lock, &lock),
    ] {
        if value != &package {
            mismatches.push(format!(
                "版本不一致：package.json={package}，{label}={value}（{}）",
                path.display()
            ));
        }
    }

    if mismatches.is_empty() {
        println!("版本检查通过：{package}");
        Ok(())
    } else {
        Err(mismatches.join("\n"))
    }
}

/// 把四处版本号统一设置为 `next`。
pub fn set(next: &str) -> Result<()> {
    if !is_semver(next) {
        return Err(format!("无效的版本号：{next}"));
    }

    let files = Files::discover();
    let package = replace_json_version(&read_text(&files.package)?, next)?;
    let tauri = replace_json_version(&read_text(&files.tauri)?, next)?;
    let cargo = replace_cargo_version(&read_text(&files.cargo)?, next)?;
    let lock = replace_cargo_version(&read_text(&files.lock)?, next)?;

    // 四个文件都替换成功后再统一写入，避免只改到一半。
    for (path, text) in [
        (&files.package, package),
        (&files.tauri, tauri),
        (&files.cargo, cargo),
        (&files.lock, lock),
    ] {
        fs::write(path, text).map_err(|error| format!("写入 {} 失败：{error}", path.display()))?;
    }

    println!("版本已设置为 {next}");
    Ok(())
}

/// 检查是否为简单的语义化版本号。
fn is_semver(value: &str) -> bool {
    let core_end = value.find(['-', '+']).unwrap_or(value.len());
    let core = &value[..core_end];
    let parts = core.split('.').collect::<Vec<_>>();
    if parts.len() != 3
        || parts
            .iter()
            .any(|part| part.is_empty() || !part.chars().all(|char| char.is_ascii_digit()))
    {
        return false;
    }

    let suffix = &value[core_end..];
    if suffix.is_empty() {
        return true;
    }
    let tail = &suffix[1..];
    !tail.is_empty()
        && tail
            .chars()
            .all(|char| char.is_ascii_alphanumeric() || char == '.' || char == '-')
}

fn read_text(path: &Path) -> Result<String> {
    fs::read_to_string(path).map_err(|error| format!("读取 {} 失败：{error}", path.display()))
}

fn read_json_version(path: &Path) -> Result<String> {
    let text = read_text(path)?;
    find_json_version(&text)
        .map(str::to_string)
        .ok_or_else(|| format!("在 {} 中找不到 version 字段", path.display()))
}

fn read_cargo_version(path: &Path) -> Result<String> {
    let text = read_text(path)?;
    find_cargo_version(&text)
        .map(str::to_string)
        .ok_or_else(|| format!("在 {} 中找不到 tauri-notes 的 version", path.display()))
}

/// 找到顶层 `"version": "x"` 的值，保持文件原始格式不变。
fn find_json_version(text: &str) -> Option<&str> {
    let key = "\"version\"";
    let mut index = text.find(key)? + key.len();
    let bytes = text.as_bytes();

    skip_whitespace(bytes, &mut index);
    if bytes.get(index) != Some(&b':') {
        return None;
    }
    index += 1;
    skip_whitespace(bytes, &mut index);
    if bytes.get(index) != Some(&b'"') {
        return None;
    }

    let start = index + 1;
    let end = start + text[start..].find('"')?;
    Some(&text[start..end])
}

fn replace_json_version(text: &str, next: &str) -> Result<String> {
    let key = "\"version\"";
    let mut index = text
        .find(key)
        .ok_or_else(|| "找不到 version 字段".to_string())?
        + key.len();
    let bytes = text.as_bytes();

    skip_whitespace(bytes, &mut index);
    if bytes.get(index) != Some(&b':') {
        return Err("version 字段格式不正确".to_string());
    }
    index += 1;
    skip_whitespace(bytes, &mut index);
    if bytes.get(index) != Some(&b'"') {
        return Err("version 值必须是字符串".to_string());
    }

    let start = index + 1;
    let end = start
        + text[start..]
            .find('"')
            .ok_or_else(|| "version 字符串没有结束引号".to_string())?;
    Ok(format!("{}{next}{}", &text[..start], &text[end..]))
}

/// 找到 `name = "tauri-notes"` 后面的第一个 `version = "x"`。
fn find_cargo_version(text: &str) -> Option<&str> {
    let name = text.find("name = \"tauri-notes\"")?;
    let version_key = "version = \"";
    let key_start = name + text[name..].find(version_key)? + version_key.len();
    let end = key_start + text[key_start..].find('"')?;
    Some(&text[key_start..end])
}

fn replace_cargo_version(text: &str, next: &str) -> Result<String> {
    let name = text
        .find("name = \"tauri-notes\"")
        .ok_or_else(|| "找不到 tauri-notes 包定义".to_string())?;
    let version_key = "version = \"";
    let key_start = name
        + text[name..]
            .find(version_key)
            .ok_or_else(|| "找不到 tauri-notes 的 version".to_string())?
        + version_key.len();
    let value_end = key_start
        + text[key_start..]
            .find('"')
            .ok_or_else(|| "version 字符串没有结束引号".to_string())?;
    Ok(format!(
        "{}{next}{}",
        &text[..key_start],
        &text[value_end..]
    ))
}

fn skip_whitespace(bytes: &[u8], index: &mut usize) {
    while bytes
        .get(*index)
        .is_some_and(|byte| byte.is_ascii_whitespace())
    {
        *index += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const JSON: &str = "{\n  \"name\": \"tauri-notes\",\n  \"version\": \"0.1.1\"\n}\n";
    const CARGO: &str =
        "[package]\nname = \"tauri-notes\"\nversion = \"0.1.1\"\nedition = \"2021\"\n";

    #[test]
    fn reads_and_replaces_json_version() {
        assert_eq!(find_json_version(JSON), Some("0.1.1"));
        assert_eq!(
            replace_json_version(JSON, "0.2.0").unwrap(),
            "{\n  \"name\": \"tauri-notes\",\n  \"version\": \"0.2.0\"\n}\n"
        );
    }

    #[test]
    fn reads_and_replaces_cargo_version() {
        assert_eq!(find_cargo_version(CARGO), Some("0.1.1"));
        assert_eq!(
            replace_cargo_version(CARGO, "0.2.0").unwrap(),
            "[package]\nname = \"tauri-notes\"\nversion = \"0.2.0\"\nedition = \"2021\"\n"
        );
    }

    #[test]
    fn validates_semver() {
        for value in ["0.1.1", "1.0.0", "0.2.0-beta.1", "1.0.0+build.5"] {
            assert!(is_semver(value), "{value} 应该合法");
        }
        for value in ["1", "1.2", "v1.2.3", "1.2.3-", "1.2.3+", "1.2.3_4"] {
            assert!(!is_semver(value), "{value} 应该不合法");
        }
    }
}
