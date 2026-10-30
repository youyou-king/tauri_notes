use serde::Deserialize;
use std::collections::{BTreeMap, HashSet};

pub const SDK_VERSION: u32 = 1;

fn default_sdk_version() -> u32 {
    SDK_VERSION
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PluginKind {
    Feature,
    Capability,
    Data,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub schema: u32,
    #[serde(default = "default_sdk_version")]
    pub sdk_version: u32,
    pub id: String,
    pub name: String,
    pub version: String,
    pub kind: PluginKind,
    #[serde(default)]
    pub provides: Vec<String>,
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default)]
    pub contributes: BTreeMap<String, Vec<String>>,
}

const CONTRIBUTION_KINDS: [&str; 9] = [
    "commands",
    "panels",
    "toolbarItems",
    "contextMenuItems",
    "settingsSections",
    "blockTypes",
    "mapNodeTypes",
    "appearancePacks",
    "migrations",
];

fn valid_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 41
        && value
            .chars()
            .all(|character| character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-')
        && value
            .chars()
            .next()
            .is_some_and(|character| character.is_ascii_lowercase() || character.is_ascii_digit())
}

fn valid_semver(value: &str) -> bool {
    let core = value.split(['-', '+']).next().unwrap_or_default();
    let parts = core.split('.').collect::<Vec<_>>();
    parts.len() == 3
        && parts
            .iter()
            .all(|part| !part.is_empty() && part.chars().all(|character| character.is_ascii_digit()))
}

pub fn validate_manifest(
    manifest: &PluginManifest,
    allowed_capabilities: &HashSet<&str>,
) -> Vec<String> {
    let mut errors = Vec::new();
    if manifest.schema != 1 {
        errors.push("schema 必须为 1".to_string());
    }
    if manifest.sdk_version != SDK_VERSION {
        errors.push(format!("sdkVersion 必须为 {SDK_VERSION}"));
    }
    if !valid_id(&manifest.id) {
        errors.push("id 只能包含小写字母、数字和连字符".to_string());
    }
    if manifest.name.trim().is_empty() || manifest.name.chars().count() > 60 {
        errors.push("name 必须为 1-60 个字符".to_string());
    }
    if !valid_semver(&manifest.version) {
        errors.push("version 必须是语义化版本".to_string());
    }
    if !manifest.provides.iter().any(|item| item == &manifest.id) {
        errors.push("provides 必须包含自身 id".to_string());
    }
    for dependency in &manifest.dependencies {
        if !valid_id(dependency) {
            errors.push(format!("非法依赖：{dependency}"));
        }
    }
    for capability in &manifest.capabilities {
        if !allowed_capabilities.contains(capability.as_str()) {
            errors.push(format!("未授权能力：{capability}"));
        }
    }
    for (kind, ids) in &manifest.contributes {
        if !CONTRIBUTION_KINDS.contains(&kind.as_str()) {
            errors.push(format!("未知贡献点：{kind}"));
        }
        if ids.is_empty() {
            errors.push(format!("贡献点 {kind} 不能为空"));
        }
    }
    errors
}

#[cfg(test)]
mod tests {
    use super::{validate_manifest, PluginManifest};
    use std::collections::{BTreeMap, HashSet};

    fn manifest(id: &str) -> PluginManifest {
        PluginManifest {
            schema: 1,
            sdk_version: super::SDK_VERSION,
            id: id.to_string(),
            name: id.to_string(),
            version: "1.0.0".to_string(),
            kind: super::PluginKind::Feature,
            provides: vec![id.to_string()],
            dependencies: Vec::new(),
            capabilities: Vec::new(),
            contributes: BTreeMap::new(),
        }
    }

    #[test]
    fn accepts_valid_manifest() {
        let errors = validate_manifest(&manifest("board"), &HashSet::new());
        assert!(errors.is_empty(), "{errors:?}");
    }

    #[test]
    fn rejects_bad_id_and_unknown_capability() {
        let mut value = manifest("Board");
        value.capabilities.push("fs.write".to_string());
        value.contributes.insert("unknown".to_string(), vec!["x".into()]);
        let errors = validate_manifest(&value, &HashSet::new());
        assert!(errors.iter().any(|error| error.contains("id")));
        assert!(errors.iter().any(|error| error.contains("fs.write")));
        assert!(errors.iter().any(|error| error.contains("未知贡献点")));
    }

    #[test]
    fn rejects_unsupported_sdk_version() {
        let mut value = manifest("board");
        value.sdk_version = 2;
        let errors = validate_manifest(&value, &HashSet::new());
        assert!(errors.iter().any(|error| error.contains("sdkVersion")));
    }
}
