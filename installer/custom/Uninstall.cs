using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class Uninstall
{
    private const string AppName = "Tauri Notes";
    private const string ProgId = "TauriNotes.note";

    [STAThread]
    private static void Main(string[] args)
    {
        bool silent = args.Length > 0 && args[0].Equals("/S", StringComparison.OrdinalIgnoreCase);
        Application.EnableVisualStyles();
        if (!silent)
        {
            if (MessageBox.Show("确定卸载 Tauri Notes？\n知识库 .note 文件不会被删除。", AppName, MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
        }
        string appDir = Path.GetDirectoryName(Application.ExecutablePath);
        foreach (Process process in Process.GetProcessesByName(AppName))
        {
            try { process.Kill(); process.WaitForExit(3000); } catch { }
        }
        TryDelete(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), AppName + ".lnk"));
        TryDelete(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), AppName + ".lnk"));
        TryDeleteKey(@"Software\Classes\.note");
        TryDeleteKey(@"Software\Classes\" + ProgId);
        TryDeleteKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\TauriNotes");
        Process.Start(new ProcessStartInfo { FileName = "cmd.exe", Arguments = "/c ping 127.0.0.1 -n 3 >nul & rd /s /q \"" + appDir + "\"", CreateNoWindow = true, UseShellExecute = false, WorkingDirectory = Path.GetTempPath() });
        if (!silent) MessageBox.Show("Tauri Notes 已卸载。", AppName, MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    private static void TryDelete(string path) { try { if (File.Exists(path)) File.Delete(path); } catch { } }
    private static void TryDeleteKey(string path) { try { Registry.CurrentUser.DeleteSubKeyTree(path, false); } catch { } }
}
