use serde::Serialize;
use tauri_notes_platform::PlatformAdapter;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
    pub kind: &'static str,
    pub file_model: &'static str,
    pub share: bool,
    pub file_association: bool,
    pub safe_area: bool,
    pub virtual_keyboard: bool,
    pub multiple_windows: bool,
}

#[cfg(desktop)]
pub fn current_platform_info() -> PlatformInfo {
    let capabilities = tauri_notes_platform::NativePlatform::new().capabilities();
    PlatformInfo {
        kind: "desktop",
        file_model: "external-path",
        share: capabilities.share,
        file_association: capabilities.file_association,
        safe_area: capabilities.safe_area,
        virtual_keyboard: capabilities.virtual_keyboard,
        multiple_windows: true,
    }
}

#[cfg(mobile)]
pub fn current_platform_info() -> PlatformInfo {
    // Mobile directories/capabilities are owned by MobilePlatform. Keep this
    // command free of platform-specific path construction.
    PlatformInfo {
        kind: "mobile",
        file_model: "managed-library",
        share: true,
        file_association: false,
        safe_area: true,
        virtual_keyboard: true,
        multiple_windows: false,
    }
}

#[tauri::command]
pub fn platform_info() -> PlatformInfo {
    current_platform_info()
}

#[cfg(test)]
mod tests {
    use super::current_platform_info;

    #[test]
    fn desktop_platform_info_reports_external_files() {
        let info = current_platform_info();
        assert_eq!(info.kind, "desktop");
        assert_eq!(info.file_model, "external-path");
        assert!(info.multiple_windows);
    }
}