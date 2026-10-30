#[cfg(not(windows))]
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SystemTheme {
    Dark,
    Light,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct PlatformCapabilities {
    pub file_association: bool,
    pub system_theme: bool,
    pub share: bool,
    pub safe_area: bool,
    pub virtual_keyboard: bool,
}

/// Platform differences are isolated behind this trait. Kernel services must
/// not branch on `cfg(windows)` or hard-code platform paths.
pub trait PlatformAdapter: Send + Sync {
    fn home_dir(&self) -> Result<PathBuf, String>;
    fn data_dir(&self) -> Result<PathBuf, String>;
    fn cache_dir(&self) -> Result<PathBuf, String>;
    fn system_theme(&self) -> SystemTheme;

    fn capabilities(&self) -> PlatformCapabilities {
        PlatformCapabilities::default()
    }

    /// Legacy theme directory used by pre-portable installs.
    fn legacy_theme_dir(&self) -> Option<PathBuf> {
        None
    }

    fn register_file_association(&self, _exe: &Path) -> Result<(), String> {
        Err("当前平台暂不支持自动注册文件关联".to_string())
    }

    fn unregister_file_association(&self) -> Result<(), String> {
        Err("当前平台暂不支持自动注册文件关联".to_string())
    }
}

/// Mobile platforms own sandboxed app directories. Tauri mobile injects those
/// paths; the adapter keeps the same contract as the desktop native adapter.
#[derive(Debug, Clone)]
pub struct MobilePlatform {
    home: PathBuf,
    data: PathBuf,
    cache: PathBuf,
}

impl MobilePlatform {
    pub fn new(home: PathBuf, data: PathBuf, cache: PathBuf) -> Self {
        Self { home, data, cache }
    }
}

impl PlatformAdapter for MobilePlatform {
    fn home_dir(&self) -> Result<PathBuf, String> {
        Ok(self.home.clone())
    }

    fn data_dir(&self) -> Result<PathBuf, String> {
        Ok(self.data.clone())
    }

    fn cache_dir(&self) -> Result<PathBuf, String> {
        Ok(self.cache.clone())
    }

    fn system_theme(&self) -> SystemTheme {
        SystemTheme::Unknown
    }

    fn capabilities(&self) -> PlatformCapabilities {
        PlatformCapabilities {
            share: true,
            safe_area: true,
            virtual_keyboard: true,
            ..PlatformCapabilities::default()
        }
    }
}

#[derive(Debug, Default, Clone, Copy)]
pub struct NativePlatform;

impl NativePlatform {
    pub fn new() -> Self {
        Self
    }
}

#[cfg(windows)]
impl PlatformAdapter for NativePlatform {
    fn home_dir(&self) -> Result<PathBuf, String> {
        std::env::var_os("USERPROFILE")
            .map(PathBuf::from)
            .ok_or_else(|| "无法确定用户目录".to_string())
    }

    fn data_dir(&self) -> Result<PathBuf, String> {
        let exe = std::env::current_exe().map_err(|error| error.to_string())?;
        let parent = exe
            .parent()
            .ok_or_else(|| "无法确定程序目录".to_string())?;
        Ok(parent.join("data"))
    }

    fn cache_dir(&self) -> Result<PathBuf, String> {
        let exe = std::env::current_exe().map_err(|error| error.to_string())?;
        let parent = exe
            .parent()
            .ok_or_else(|| "无法确定程序目录".to_string())?;
        Ok(parent.join("cache"))
    }

    fn system_theme(&self) -> SystemTheme {
        SystemTheme::Unknown
    }

    fn legacy_theme_dir(&self) -> Option<PathBuf> {
        std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .map(|root| root.join("com.example.tauri-notes").join("themes"))
    }

    fn register_file_association(&self, exe: &Path) -> Result<(), String> {
        use std::os::windows::process::CommandExt;

        let exe_text = exe.to_string_lossy();
        let base = "HKCU\\Software\\Classes";
        let entries = [
            (format!("{base}\\.note"), "TauriNotes.note".to_string()),
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

    fn unregister_file_association(&self) -> Result<(), String> {
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

    fn capabilities(&self) -> PlatformCapabilities {
        PlatformCapabilities {
            file_association: true,
            ..PlatformCapabilities::default()
        }
    }
}

#[cfg(target_os = "macos")]
impl PlatformAdapter for NativePlatform {
    fn home_dir(&self) -> Result<PathBuf, String> {
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .ok_or_else(|| "无法确定用户目录".to_string())
    }

    fn data_dir(&self) -> Result<PathBuf, String> {
        Ok(self
            .home_dir()?
            .join("Library")
            .join("Application Support")
            .join("TauriNotes"))
    }

    fn cache_dir(&self) -> Result<PathBuf, String> {
        Ok(self
            .home_dir()?
            .join("Library")
            .join("Caches")
            .join("TauriNotes"))
    }

    fn system_theme(&self) -> SystemTheme {
        SystemTheme::Unknown
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
impl PlatformAdapter for NativePlatform {
    fn home_dir(&self) -> Result<PathBuf, String> {
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .ok_or_else(|| "无法确定用户目录".to_string())
    }

    fn data_dir(&self) -> Result<PathBuf, String> {
        std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|| self.home_dir().ok().map(|home| home.join(".local").join("share")))
            .map(|root| root.join("tauri-notes"))
            .ok_or_else(|| "无法确定数据目录".to_string())
    }

    fn cache_dir(&self) -> Result<PathBuf, String> {
        std::env::var_os("XDG_CACHE_HOME")
            .map(PathBuf::from)
            .or_else(|| self.home_dir().ok().map(|home| home.join(".cache")))
            .map(|root| root.join("tauri-notes"))
            .ok_or_else(|| "无法确定缓存目录".to_string())
    }

    fn system_theme(&self) -> SystemTheme {
        SystemTheme::Unknown
    }
}

/// Atomically replaces `to` with `from`.
///
/// Windows uses `MoveFileExW` with replace/write-through flags; other
/// platforms use `rename`, which is atomic on the same filesystem.
pub fn replace_file(from: &Path, to: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Storage::FileSystem::{
            MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
        };

        let from: Vec<u16> =
            from.as_os_str().encode_wide().chain(Some(0)).collect();
        let to: Vec<u16> =
            to.as_os_str().encode_wide().chain(Some(0)).collect();
        let ok = unsafe {
            MoveFileExW(
                from.as_ptr(),
                to.as_ptr(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        };
        if ok == 0 {
            return Err(format!(
                "原子替换失败: {}",
                std::io::Error::last_os_error()
            ));
        }
        Ok(())
    }

    #[cfg(not(windows))]
    {
        fs::rename(from, to)
            .map_err(|error| format!("替换 {} 失败: {error}", to.display()))
    }
}

#[cfg(test)]
mod tests {
    use super::{MobilePlatform, NativePlatform, PlatformAdapter};
    use std::path::PathBuf;

    #[test]
    fn resolves_platform_directories() {
        let platform = NativePlatform::new();
        assert!(platform.home_dir().is_ok());
        assert!(platform.data_dir().is_ok());
        assert!(platform.cache_dir().is_ok());
    }

    #[test]
    fn mobile_platform_owns_sandboxed_directories() {
        let platform = MobilePlatform::new(
            PathBuf::from("/sandbox/home"),
            PathBuf::from("/sandbox/data"),
            PathBuf::from("/sandbox/cache"),
        );
        assert_eq!(
            platform.data_dir().unwrap(),
            PathBuf::from("/sandbox/data")
        );
        let capabilities = platform.capabilities();
        assert!(capabilities.share);
        assert!(capabilities.safe_area);
        assert!(capabilities.virtual_keyboard);
        assert!(!capabilities.file_association);
        assert!(platform.legacy_theme_dir().is_none());
    }

    #[test]
    fn replaces_files_atomically() {
        let root = std::env::temp_dir().join(format!(
            "tauri-notes-platform-replace-{}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        let source = root.join("source.txt");
        let target = root.join("target.txt");
        fs::write(&source, "new").unwrap();
        fs::write(&target, "old").unwrap();

        super::replace_file(&source, &target).unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "new");
        assert!(!source.exists());
        fs::remove_dir_all(&root).unwrap();
    }

    use std::fs;

    #[cfg(windows)]
    #[test]
    fn windows_capabilities_include_file_association() {
        assert!(
            NativePlatform::new().capabilities().file_association
        );
        assert!(NativePlatform::new().legacy_theme_dir().is_some());
    }
}
