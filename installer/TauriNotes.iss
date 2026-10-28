#define MyAppName "Tauri Notes"
#define MyAppVersion "0.1.0"
#define MyAppExeName "Tauri Notes.exe"

[Setup]
AppId={{9B6D2F4A-4D8E-4C3A-9C62-7A5F0B2E6D11}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=Tauri Notes
DefaultDirName={autopf}\Tauri Notes
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=admin
OutputDir=C:\Users\19189\Desktop\笔记软件\installer-output
OutputBaseFilename=Tauri Notes Setup Admin
SetupIconFile=C:\Users\19189\Desktop\笔记软件\tauri_notes\src-tauri\icons\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Files]
Source: "C:\Users\19189\Desktop\笔记软件\tauri_notes\src-tauri\target\release\tauri-notes.exe"; DestDir: "{app}"; DestName: "{#MyAppExeName}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加任务:"

[Registry]
Root: HKLM; Subkey: "Software\Classes\.note"; ValueType: string; ValueName: ""; ValueData: "TauriNotes.note"; Flags: uninsdeletevalue
Root: HKLM; Subkey: "Software\Classes\TauriNotes.note"; ValueType: string; ValueName: ""; ValueData: "Tauri Notes Knowledge Base"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Classes\TauriNotes.note\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#MyAppExeName},0"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Classes\TauriNotes.note\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Flags: uninsdeletekey

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "启动 {#MyAppName}"; Flags: nowait postinstall skipifsilent runasoriginaluser
