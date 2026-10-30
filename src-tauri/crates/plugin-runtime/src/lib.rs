use std::collections::{BTreeMap, BTreeSet, HashMap, VecDeque};
use tauri_notes_plugin_api::PluginManifest;

/// Resolves a deterministic activation order. The order follows the input
/// order whenever the dependency graph allows it.
pub fn plan_activation(
    manifests: &[PluginManifest],
) -> Result<Vec<String>, Vec<String>> {
    let mut errors = Vec::new();
    let mut ids = BTreeSet::new();
    for manifest in manifests {
        if !ids.insert(manifest.id.clone()) {
            errors.push(format!("插件 id 重复：{}", manifest.id));
        }
    }
    if !errors.is_empty() {
        return Err(errors);
    }

    let mut provider = HashMap::<String, String>::new();
    for manifest in manifests {
        for provided in &manifest.provides {
            if let Some(existing) = provider.insert(provided.clone(), manifest.id.clone()) {
                errors.push(format!(
                    "提供项 {provided} 同时由 {existing} 和 {} 声明",
                    manifest.id
                ));
            }
        }
        provider
            .entry(manifest.id.clone())
            .or_insert_with(|| manifest.id.clone());
    }

    let mut index = HashMap::<String, usize>::new();
    for (position, manifest) in manifests.iter().enumerate() {
        index.insert(manifest.id.clone(), position);
    }

    let mut indegree = BTreeMap::<String, usize>::new();
    let mut edges = BTreeMap::<String, Vec<String>>::new();
    for manifest in manifests {
        let mut count = 0;
        for dependency in &manifest.dependencies {
            let Some(dependency_id) = provider.get(dependency) else {
                errors.push(format!(
                    "插件 {} 缺少依赖：{dependency}",
                    manifest.id
                ));
                continue;
            };
            if dependency_id == &manifest.id {
                errors.push(format!("插件 {} 依赖自身", manifest.id));
                continue;
            }
            count += 1;
            edges
                .entry(dependency_id.clone())
                .or_default()
                .push(manifest.id.clone());
        }
        indegree.insert(manifest.id.clone(), count);
    }

    if !errors.is_empty() {
        return Err(errors);
    }

    let mut ready = VecDeque::new();
    let mut initial = manifests
        .iter()
        .filter(|manifest| indegree.get(&manifest.id) == Some(&0))
        .map(|manifest| manifest.id.clone())
        .collect::<Vec<_>>();
    initial.sort_by_key(|id| index[id]);
    ready.extend(initial);

    let mut order = Vec::new();
    while let Some(id) = ready.pop_front() {
        order.push(id.clone());
        let mut dependents = edges.remove(&id).unwrap_or_default();
        dependents.sort_by_key(|dependent| index[dependent]);
        for dependent in dependents {
            let entry = indegree
                .get_mut(&dependent)
                .expect("dependent must have an indegree");
            *entry = entry.saturating_sub(1);
            if *entry == 0 {
                ready.push_back(dependent);
            }
        }
    }

    if order.len() != manifests.len() {
        let mut remaining = manifests
            .iter()
            .filter(|manifest| !order.contains(&manifest.id))
            .map(|manifest| manifest.id.clone())
            .collect::<Vec<_>>();
        remaining.sort_by_key(|id| index.get(id).copied().unwrap_or(0));
        errors.push(format!("插件存在循环依赖：{}", remaining.join(" → ")));
    }

    if errors.is_empty() {
        Ok(order)
    } else {
        Err(errors)
    }
}

#[cfg(test)]
mod tests {
    use super::plan_activation;
    use std::collections::BTreeMap;
    use tauri_notes_plugin_api::{PluginKind, PluginManifest, SDK_VERSION};

    fn manifest(id: &str, dependencies: &[&str]) -> PluginManifest {
        PluginManifest {
            schema: 1,
            sdk_version: SDK_VERSION,
            id: id.to_string(),
            name: id.to_string(),
            version: "1.0.0".to_string(),
            kind: PluginKind::Feature,
            provides: vec![id.to_string()],
            dependencies: dependencies.iter().map(|item| item.to_string()).collect(),
            capabilities: Vec::new(),
            contributes: BTreeMap::new(),
        }
    }

    #[test]
    fn orders_dependencies_before_plugins() {
        let order = plan_activation(&[
            manifest("board", &[]),
            manifest("reference", &["board"]),
            manifest("help", &[]),
        ])
        .unwrap();
        assert_eq!(order, vec!["board", "help", "reference"]);
    }

    #[test]
    fn reports_missing_and_duplicate_dependencies() {
        let missing = plan_activation(&[manifest("board", &["storage"])]).unwrap_err();
        assert!(missing.iter().any(|error| error.contains("storage")));

        let duplicate = plan_activation(&[manifest("board", &[]), manifest("board", &[])])
            .unwrap_err();
        assert!(duplicate.iter().any(|error| error.contains("重复")));
    }

    #[test]
    fn reports_cycles() {
        let errors = plan_activation(&[
            manifest("a", &["b"]),
            manifest("b", &["a"]),
        ])
        .unwrap_err();
        assert!(errors.iter().any(|error| error.contains("循环依赖")));
    }
}
