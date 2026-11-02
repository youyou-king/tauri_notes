use serde::Serialize;
use tauri::{
    plugin::{Builder, PluginHandle, TauriPlugin},
    Manager, Runtime,
};

#[derive(Serialize)]
struct SharePayload {
    path: String,
    mime: String,
}

/// Handle for the app-specific Android share plugin.
pub struct ShareHandle<R: Runtime>(PluginHandle<R>);

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("share")
        .setup(|app, api| {
            let handle = api.register_android_plugin(
                "com.youyou.taurinotes",
                "SharePlugin",
            )?;
            app.manage(ShareHandle(handle));
            Ok(())
        })
        .build()
}

pub fn share_library<R: Runtime>(
    handle: &ShareHandle<R>,
    path: &str,
) -> Result<(), String> {
    handle
        .0
        .run_mobile_plugin::<serde_json::Value>(
            "shareFile",
            SharePayload {
                path: path.to_string(),
                mime: "application/octet-stream".into(),
            },
        )
        .map(|_| ())
        .map_err(|error| format!("系统分享失败：{error}"))
}