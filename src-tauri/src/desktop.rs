use crate::platform_state::PlatformState;
use crate::queue_note_path;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(path) = crate::startup_note_arg() {
        queue_note_path(path);
    }
    let profile = if cfg!(debug_assertions) { "dev" } else { "release" };
    let data_dir = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|dir| dir.to_path_buf()))
        .map(|dir| dir.join("cache").join("webview2").join(profile))
        .filter(|dir| std::fs::create_dir_all(dir).is_ok())
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

    let mut builder = WebviewWindowBuilder::new(
        app,
        "main",
        WebviewUrl::App("index.html".into()),
    )
    .title("Tauri Notes")
    .inner_size(1100.0, 760.0)
    .min_inner_size(900.0, 600.0)
    .data_directory(data_dir);

    // Keep the WebView sandbox by default. The escape hatch exists for
    // environments where WebView2 cannot start with its sandbox.
    if std::env::var_os("TAURI_NOTES_DISABLE_SANDBOX").is_some() {
        builder = builder.additional_browser_args("--no-sandbox");
    }

    let window = builder
        // 关闭 Tauri 原生拖放处理器，否则 WebView2 内 Dockview 标签拖拽失效。
        .disable_drag_drop_handler()
        .build()
        .map_err(|error| std::io::Error::other(format!("创建窗口失败: {error}")))?;

    window.set_focus()?;
    Ok(())
}

/// Adds desktop-only plugins, window creation, and file-open routing.
pub fn configure(
    builder: tauri::Builder<tauri::Wry>,
) -> tauri::Builder<tauri::Wry> {
    builder
        .manage(PlatformState::desktop())
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
        .setup(|app| {
            setup(app)?;
            Ok(())
        })
}