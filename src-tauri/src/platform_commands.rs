use crate::platform_state::PlatformState;
use serde::Serialize;
use tauri::State;

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

fn info_for(state: &PlatformState) -> PlatformInfo {
    let capabilities = state.adapter.capabilities();
    PlatformInfo {
        kind: state.kind,
        file_model: state.file_model,
        share: capabilities.share,
        file_association: capabilities.file_association,
        safe_area: capabilities.safe_area,
        virtual_keyboard: capabilities.virtual_keyboard,
        multiple_windows: state.kind == "desktop",
    }
}

#[tauri::command]
pub fn platform_info(state: State<'_, PlatformState>) -> PlatformInfo {
    info_for(&state)
}

#[cfg(test)]
mod tests {
    use super::info_for;
    use crate::platform_state::PlatformState;

    #[test]
    fn desktop_platform_info_reports_external_files() {
        let info = info_for(&PlatformState::desktop());
        assert_eq!(info.kind, "desktop");
        assert_eq!(info.file_model, "external-path");
        assert!(info.multiple_windows);
    }
}
