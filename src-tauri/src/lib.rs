mod board_commands;
mod commands;
#[cfg(desktop)]
mod desktop;
mod document_commands;
mod import_commands;
mod keymap_commands;
mod managed_library;
mod content_commands;
mod command_error;
#[cfg(mobile)]
mod mobile;
mod platform_commands;
mod platform_state;
mod storage_commands;
mod workspace_commands;

pub use tauri_notes_document::document;

pub use tauri_notes_document::{document_store, map_store};
pub use tauri_notes_storage::{database, sqlite};

use std::collections::HashSet;
use std::sync::Mutex;
use tauri_notes_plugin_api::{validate_manifest, PluginManifest};
use tauri_notes_plugin_runtime::plan_activation;

static PENDING_NOTE: Mutex<Option<String>> = Mutex::new(None);

pub(crate) fn queue_note_path(path: String) {
    if let Ok(mut pending) = PENDING_NOTE.lock() {
        *pending = Some(path);
    }
}

fn note_arg(args: &[String]) -> Option<String> {
    args.iter()
        .find(|arg| arg.to_lowercase().ends_with(".note"))
        .cloned()
}

#[cfg(windows)]
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}

#[cfg(windows)]
fn is_restricted_process() -> bool {
    let output = std::process::Command::new("whoami")
        .arg("/groups")
        .output();
    let Ok(output) = output else {
        return false;
    };
    let text = String::from_utf8_lossy(&output.stdout).to_lowercase();
    text.contains("codexsandboxusers")
        || text.contains("low mandatory level")
        || text.contains("低强制级别")
}

#[cfg(windows)]
fn relaunch_as_normal() -> bool {
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    let (file, params, directory) = if cfg!(debug_assertions) {
        let dev = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("dev.cmd");
        (
            wide(r"C:\Windows\System32\cmd.exe"),
            wide(&format!("/c \"\"{}\" --relaunched\"", dev.display())),
            wide(&dev.parent().unwrap().display().to_string()),
        )
    } else {
        let exe = std::env::current_exe().unwrap_or_default();
        (
            wide(&exe.display().to_string()),
            wide("--relaunched"),
            wide(&exe.parent().unwrap().display().to_string()),
        )
    };
    let verb = wide("runas");
    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            verb.as_ptr(),
            file.as_ptr(),
            params.as_ptr(),
            directory.as_ptr(),
            SW_SHOWNORMAL,
        )
    };
    (result as usize as isize) > 32
}

pub(crate) fn startup_note_arg() -> Option<String> {
    let args = std::env::args().collect::<Vec<_>>();
    note_arg(&args)
}

#[tauri::command]
fn take_pending_note_file() -> Option<String> {
    PENDING_NOTE.lock().ok().and_then(|mut pending| pending.take())
}

#[tauri::command]
fn register_note_association(
    state: tauri::State<'_, platform_state::PlatformState>,
) -> Result<(), String> {
    let exe = std::env::current_exe()
        .map_err(|error| format!("获取程序路径失败: {error}"))?;
    state.adapter.register_file_association(&exe)
}

#[tauri::command]
fn unregister_note_association(
    state: tauri::State<'_, platform_state::PlatformState>,
) -> Result<(), String> {
    state.adapter.unregister_file_association()
}


#[tauri::command]
fn help_note_path() -> Result<String, String> {
    let mut candidates = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("help.note"));
        }
    }
    candidates.push(
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("resources")
            .join("help.note"),
    );
    for candidate in candidates {
        if candidate.is_file() {
            return Ok(candidate.to_string_lossy().into_owned());
        }
    }
    Err("未找到帮助知识库 help.note".into())
}

#[tauri::command]
fn validate_plugin_manifest(
    manifest: serde_json::Value,
    allowed_capabilities: Option<Vec<String>>,
) -> Result<Vec<String>, String> {
    let parsed: PluginManifest =
        serde_json::from_value(manifest).map_err(|error| error.to_string())?;
    let allowed = allowed_capabilities.unwrap_or_default();
    let allowed_refs: HashSet<&str> =
        allowed.iter().map(String::as_str).collect();
    Ok(validate_manifest(&parsed, &allowed_refs))
}

#[tauri::command]
fn plugin_sdk_version() -> u32 {
    tauri_notes_plugin_api::SDK_VERSION
}

#[tauri::command]
async fn list_managed_libraries(
    state: tauri::State<'_, platform_state::PlatformState>,
) -> Result<Vec<managed_library::ManagedLibrarySummary>, String> {
    let data_dir = { state.adapter.data_dir()? };
    managed_library::list_libraries(&data_dir)
}

#[tauri::command]
fn new_managed_library_path(
    state: tauri::State<'_, platform_state::PlatformState>,
    title: String,
) -> Result<String, String> {
    let data_dir = { state.adapter.data_dir()? };
    let path = managed_library::new_library_path(&title, &data_dir)?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
async fn export_managed_library(
    source: String,
    destination: String,
) -> Result<String, String> {
    managed_library::export_library(
        std::path::Path::new(&source),
        std::path::Path::new(&destination),
    )
    .await
}

#[tauri::command]
async fn import_managed_library(
    state: tauri::State<'_, platform_state::PlatformState>,
    source: String,
) -> Result<managed_library::ManagedLibrarySummary, String> {
    let data_dir = { state.adapter.data_dir()? };
    managed_library::import_library(std::path::Path::new(&source), &data_dir)
        .await
}

#[tauri::command]
fn plan_plugin_activation(
    manifests: Vec<PluginManifest>,
) -> Result<Vec<String>, Vec<String>> {
    plan_activation(&manifests)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(windows)]
    {
        let relaunched = std::env::args().any(|arg| arg == "--relaunched")
            || std::env::var("TAURI_NOTES_RELAUNCHED").is_ok();
        let restricted = is_restricted_process();
        if !relaunched && restricted && relaunch_as_normal() {
            std::process::exit(0);
        }
    }

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            take_pending_note_file,
            register_note_association,
            unregister_note_association,
            help_note_path,
            validate_plugin_manifest,
            plugin_sdk_version,
            platform_commands::platform_info,
            list_managed_libraries,
            import_managed_library,
            export_managed_library,
            new_managed_library_path,
            keymap_commands::load_keymap,
            keymap_commands::save_keymap,
            keymap_commands::export_keymap,
            keymap_commands::import_keymap,
            plan_plugin_activation,
            workspace_commands::open_workspace,
            workspace_commands::create_note_file,
            workspace_commands::open_note_workspace,
            workspace_commands::save_note_file,
            workspace_commands::read_document,
            workspace_commands::document_modified,
            workspace_commands::index_document,
            workspace_commands::save_block,
            workspace_commands::split_block,
            workspace_commands::merge_blocks,
            workspace_commands::save_block_range,
            workspace_commands::write_document,
            workspace_commands::delete_blocks,
            workspace_commands::insert_blocks,
            workspace_commands::search_workspace,
            workspace_commands::search_blocks_db,
            storage_commands::initialize_database,
            storage_commands::database_status,
            storage_commands::backup_database,
            storage_commands::verify_database,
            storage_commands::close_workspace_database,
            import_commands::import_markdown_workspace,
            document_commands::list_imported_documents,
            document_commands::load_document_blocks,
            document_commands::load_blocks_preview,
            document_commands::index_blocks_db,
            document_commands::save_imported_blocks,
            document_commands::create_imported_document,
            document_commands::get_imported_document_title,
            document_commands::rename_imported_document,
            document_commands::list_deleted_documents,
            document_commands::restore_imported_document,
            document_commands::delete_imported_document,
            document_commands::load_document_tree,
            document_commands::load_mind_map,
            document_commands::load_outline,
            document_commands::create_mind_map,
            document_commands::rename_mind_map,
            document_commands::delete_mind_map,
            document_commands::delete_map_node,
            document_commands::create_map_node,
            document_commands::rename_map_node,
            document_commands::set_map_node_position,
            document_commands::create_document_for_map_root,
            document_commands::create_document_for_map_node,
            document_commands::bind_document_to_map_node,
            import_commands::import_boards,
            board_commands::list_boards_db,
            board_commands::read_board_db,
            board_commands::save_board_db,
            board_commands::delete_board_db,
            content_commands::copy_image_asset,
            content_commands::save_image_asset,
            content_commands::save_note_image_asset,
            content_commands::load_reference_preview,
            content_commands::list_reference_targets,
            content_commands::relink_reference,
            commands::theme::list_custom_themes,
            commands::theme::save_custom_theme,
            commands::theme::delete_custom_theme
        ]);

    #[cfg(desktop)]
    let builder = desktop::configure(builder);
    #[cfg(mobile)]
    let builder = mobile::configure(builder);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
