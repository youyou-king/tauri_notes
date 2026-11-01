use std::path::{Path, PathBuf};

const HELP_FILE: &str = "help.note";

/// Resolve the bundled help workspace. Release builds read Tauri resources;
/// development can fall back to the repository `resources/` directory.
pub fn resolve_help_note(
    resource_dir: Option<&Path>,
    dev_root: &Path,
) -> Option<PathBuf> {
    if let Some(resource_dir) = resource_dir {
        for candidate in [
            resource_dir.join("resources").join(HELP_FILE),
            resource_dir.join(HELP_FILE),
        ] {
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    let dev = dev_root.join("resources").join(HELP_FILE);
    dev.is_file().then_some(dev)
}

#[cfg(test)]
mod tests {
    use super::resolve_help_note;
    use std::fs;

    fn temp_root(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "tauri-notes-help-{name}-{}",
            std::process::id()
        ))
    }

    #[test]
    fn prefers_resource_directory() {
        let root = temp_root("resource");
        let resources = root.join("resources");
        fs::create_dir_all(&resources).unwrap();
        fs::write(resources.join("help.note"), "help").unwrap();
        let resolved = resolve_help_note(Some(&root), &root).unwrap();
        assert_eq!(resolved, resources.join("help.note"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn falls_back_to_dev_resources() {
        let root = temp_root("dev");
        let resources = root.join("resources");
        fs::create_dir_all(&resources).unwrap();
        fs::write(resources.join("help.note"), "help").unwrap();
        let resolved = resolve_help_note(None, &root).unwrap();
        assert_eq!(resolved, resources.join("help.note"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn returns_none_when_missing() {
        let root = temp_root("missing");
        assert!(resolve_help_note(Some(&root), &root).is_none());
    }
}