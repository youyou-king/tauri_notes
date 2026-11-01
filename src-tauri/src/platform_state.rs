use std::sync::Arc;

use tauri_notes_platform::{NativePlatform, PlatformAdapter};
#[cfg(mobile)]
use tauri_notes_platform::MobilePlatform;

/// Single injection point for platform services. Commands receive this from
/// Tauri state and never build NativePlatform/MobilePlatform themselves.
pub struct PlatformState {
    pub adapter: Arc<dyn PlatformAdapter>,
    pub kind: &'static str,
    pub file_model: &'static str,
}

impl PlatformState {
    pub fn desktop() -> Self {
        Self {
            adapter: Arc::new(NativePlatform::new()),
            kind: "desktop",
            file_model: "external-path",
        }
    }

    #[cfg(mobile)]
    pub fn mobile(home: std::path::PathBuf, data: std::path::PathBuf, cache: std::path::PathBuf) -> Self {
        Self {
            adapter: Arc::new(MobilePlatform::new(home, data, cache)),
            kind: "mobile",
            file_model: "managed-library",
        }
    }
}