mod assets;
mod board_import;
mod board_store;
mod commands;
mod database;
mod document;
mod document_store;
mod importer;
mod map_store;
mod references;
mod services;
mod sqlite;
mod workspace;

use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use std::sync::Mutex;

static PENDING_NOTE: Mutex<Option<String>> = Mutex::new(None);

fn queue_note_path(path: String) {
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
            SW_SHOWNORMAL as i32,
        )
    };
    (result as usize as isize) > 32
}

#[tauri::command]
fn startup_note_file() -> Option<String> {
    let args = std::env::args().collect::<Vec<_>>();
    note_arg(&args)
}

#[tauri::command]
fn take_pending_note_file() -> Option<String> {
    PENDING_NOTE.lock().ok().and_then(|mut pending| pending.take())
}

#[tauri::command]
fn register_note_association() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let exe = std::env::current_exe()
            .map_err(|error| format!("获取程序路径失败: {error}"))?;
        let exe_text = exe.to_string_lossy();
        let base = "HKCU\\Software\\Classes";
        let entries = [
            (
                format!("{base}\\.note"),
                "TauriNotes.note".to_string(),
            ),
            (
                format!("{base}\\TauriNotes.note"),
                "Tauri Notes 知识库".to_string(),
            ),
            (
                format!("{base}\\TauriNotes.note\\DefaultIcon"),
                format!("\"{exe_text}\",0"),
            ),
            (
                format!("{base}\\TauriNotes.note\\shell\\open\\command"),
                format!("\"{exe_text}\" \"%1\""),
            ),
        ];
        for (key, value) in entries {
            let status = std::process::Command::new("reg")
                .args(["add", &key, "/ve", "/t", "REG_SZ", "/d", &value, "/f"])
                .creation_flags(0x08000000)
                .status()
                .map_err(|error| format!("注册 .note 文件关联失败: {error}"))?;
            if !status.success() {
                return Err(format!("注册注册表项失败: {key}"));
            }
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err("当前平台暂不支持自动注册文件关联".into())
    }
}

#[tauri::command]
fn unregister_note_association() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        for key in [
            "HKCU\\Software\\Classes\\.note",
            "HKCU\\Software\\Classes\\TauriNotes.note",
        ] {
            let _ = std::process::Command::new("reg")
                .args(["delete", key, "/f"])
                .creation_flags(0x08000000)
                .status();
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err("当前平台暂不支持".into())
    }
}

#[tauri::command]
fn get_process_integrity_level() -> u32 {
    #[cfg(windows)]
    {
        if is_restricted_process() {
            0x1000
        } else {
            0x2000
        }
    }
    #[cfg(not(windows))]
    {
        0x2000
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Tauri 后端已连接：{name}")
}

#[tauri::command]
fn demo_workspace() -> Result<String, String> {
    let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("sample.notes");
    path.canonicalize()
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|error| format!("找不到示例知识库 {}: {error}", path.display()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(windows)]
    {
        let relaunched = std::env::args().any(|arg| arg == "--relaunched")
            || std::env::var("TAURI_NOTES_RELAUNCHED").is_ok();
        let restricted = is_restricted_process();
        if !relaunched && restricted {
            if relaunch_as_normal() {
                std::process::exit(0);
            }
        }
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(path) = argv
                .iter()
                .skip(1)
                .find(|arg| arg.to_lowercase().ends_with(".note"))
            {
                queue_note_path(path.clone());
                let _ = app.emit("open-note-file", path.clone());
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if let Some(path) = startup_note_file() {
                queue_note_path(path);
            }
            let profile = if cfg!(debug_assertions) { "dev" } else { "release" };
            let data_dir = app
                .path()
                .app_local_data_dir()
                .ok()
                .map(|dir| dir.join("webview2").join(profile))
                .filter(|dir| {
                    std::fs::create_dir_all(dir).is_ok()
                })
                .unwrap_or_else(|| {
                    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                        .join("..")
                        .join(".webview2")
                        .join(profile)
                });
            std::fs::create_dir_all(&data_dir).map_err(|error| {
                std::io::Error::other(format!(
                    "创建 WebView2 数据目录 {}: {error}",
                    data_dir.display()
                ))
            })?;

            let window = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::App("index.html".into()),
            )
            .title("Tauri Notes")
            .inner_size(1100.0, 760.0)
            .min_inner_size(900.0, 600.0)
            .data_directory(data_dir)
            .additional_browser_args("--no-sandbox")
            // 关闭 Tauri 原生拖放处理器，否则 WebView2 内 Dockview 标签拖拽失效。
            .disable_drag_drop_handler()
            .build()
            .map_err(|error| std::io::Error::other(format!("创建窗口失败: {error}")))?;

            window.set_focus()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            startup_note_file,
            take_pending_note_file,
            register_note_association,
            unregister_note_association,
            get_process_integrity_level,
            demo_workspace,
            workspace::open_workspace,
            workspace::create_note_file,
            workspace::open_note_workspace,
            workspace::save_note_file,
            workspace::read_document,
            workspace::document_modified,
            workspace::index_document,
            workspace::save_block,
            workspace::split_block,
            workspace::merge_blocks,
            workspace::save_block_range,
            workspace::write_document,
            workspace::delete_blocks,
            workspace::insert_blocks,
            workspace::search_workspace,
            workspace::search_blocks_db,
            database::initialize_database,
            database::database_status,
            database::backup_database,
            importer::import_markdown_workspace,
            document_store::list_imported_documents,
            document_store::load_document_blocks,
            document_store::load_blocks_preview,
            document_store::index_blocks_db,
            document_store::save_imported_blocks,
            document_store::create_imported_document,
            document_store::get_imported_document_title,
            document_store::rename_imported_document,
            document_store::delete_imported_document,
            document_store::load_document_tree,
            map_store::load_mind_map,
            map_store::load_outline,
            map_store::create_mind_map,
            map_store::rename_mind_map,
            map_store::delete_mind_map,
            map_store::delete_map_node,
            map_store::create_map_node,
            map_store::rename_map_node,
            map_store::set_map_node_position,
            map_store::create_document_for_map_root,
            map_store::create_document_for_map_node,
            map_store::bind_document_to_map_node,
            board_import::import_boards,
            board_store::list_boards_db,
            board_store::read_board_db,
            board_store::save_board_db,
            board_store::delete_board_db,
            assets::copy_image_asset,
            assets::save_image_asset,
            assets::save_note_image_asset,
            references::load_reference_preview,
            references::list_reference_targets,
            references::relink_reference,
            commands::theme::list_custom_themes,
            commands::theme::save_custom_theme,
            commands::theme::delete_custom_theme
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
