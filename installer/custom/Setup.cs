using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class Setup
{
    private const string AppName = "Tauri Notes";
    private const string ProgId = "TauriNotes.note";
    private static readonly object LogLock = new object();
    private static string logPath = "";
    private static readonly string fallbackLogPath =
        Path.Combine(Path.GetTempPath(), "TauriNotes-install.log");

    private static string LogPath
    {
        get
        {
            return string.IsNullOrEmpty(logPath) ? fallbackLogPath : logPath;
        }
    }

    internal static void SetLogTarget(string appDir)
    {
        try
        {
            Directory.CreateDirectory(appDir);
            string candidate = Path.Combine(appDir, "install.log");
            using (FileStream probe = new FileStream(
                candidate,
                FileMode.Append,
                FileAccess.Write,
                FileShare.Read))
            {
                probe.Flush();
            }
            string previous = logPath;
            logPath = candidate;
            if (!string.IsNullOrEmpty(previous)
                && !string.Equals(previous, candidate, StringComparison.OrdinalIgnoreCase)
                && File.Exists(previous))
            {
                try
                {
                    File.AppendAllText(candidate, File.ReadAllText(previous));
                    File.Delete(previous);
                }
                catch
                {
                    // Keep writing to the install directory even if the old log cannot be moved.
                }
            }
        }
        catch
        {
            logPath = fallbackLogPath;
        }
    }

    internal static void Log(string message)
    {
        try
        {
            lock (LogLock)
            {
                File.AppendAllText(
                    LogPath,
                    DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + " " + message + Environment.NewLine);
            }
        }
        catch
        {
            // The installer must never fail because logging failed.
        }
    }

    internal static void LogException(string context, Exception exception)
    {
        Log(context + ": " + exception);
    }

    [STAThread]
    private static void Main(string[] args)
    {
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += delegate(object sender, ThreadExceptionEventArgs eventArgs)
        {
            LogException("UI thread exception", eventArgs.Exception);
            MessageBox.Show(
                "安装程序遇到错误：\n" + eventArgs.Exception.Message + "\n\n日志：" + LogPath,
                AppName,
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        };
        AppDomain.CurrentDomain.UnhandledException += delegate(object sender, UnhandledExceptionEventArgs eventArgs)
        {
            Exception exception = eventArgs.ExceptionObject as Exception;
            LogException("Unhandled exception", exception ?? new Exception("unknown exception"));
        };
        Log("Setup starting: " + string.Join(" ", args));
        bool createdNew;
        using (Mutex mutex = new Mutex(true, @"Global\TauriNotesSetup", out createdNew))
        {
            if (!createdNew)
            {
                MessageBox.Show("安装程序已经在运行。", AppName, MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            Run(args);
        }
    }

    private static void Run(string[] args)
    {
        bool silent = false;
        string overrideDir = null;
        bool noDesktop = false;
        bool noAssociate = false;
        bool noLaunch = false;
        bool progressTest = false;
        foreach (string arg in args)
        {
            if (arg.Equals("/S", StringComparison.OrdinalIgnoreCase)) silent = true;
            else if (arg.Equals("/PROGRESSTEST", StringComparison.OrdinalIgnoreCase)) progressTest = true;
            else if (arg.StartsWith("/D=", StringComparison.OrdinalIgnoreCase)) overrideDir = arg.Substring(3).Trim('"');
            else if (arg.Equals("/NODESKTOP", StringComparison.OrdinalIgnoreCase)) noDesktop = true;
            else if (arg.Equals("/NOASSOC", StringComparison.OrdinalIgnoreCase)) noAssociate = true;
            else if (arg.Equals("/NOLAUNCH", StringComparison.OrdinalIgnoreCase)) noLaunch = true;
        }
        Application.EnableVisualStyles();
        try
        {
            string defaultDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                "TauriNotes");
            InstallOptions options = (silent || progressTest)
                ? new InstallOptions
                {
                    Directory = string.IsNullOrWhiteSpace(overrideDir) ? defaultDir : overrideDir,
                    DesktopShortcut = !noDesktop,
                    AssociateNote = !noAssociate,
                    NoLaunch = noLaunch
                }
                : AskOptions(defaultDir);
            if (options == null)
            {
                return;
            }
            if (progressTest)
            {
                options.DesktopShortcut = false;
                options.AssociateNote = false;
                options.NoLaunch = true;
                using (InstallProgressForm form = new InstallProgressForm(options))
                {
                    form.ShowDialog();
                }
                return;
            }
            if (silent)
            {
                PerformInstall(options, null);
                if (!noLaunch)
                {
                    try { Process.Start(Path.Combine(options.Directory, AppName + ".exe")); } catch { }
                }
            }
            else
            {
                using (InstallProgressForm form = new InstallProgressForm(options))
                {
                    form.ShowDialog();
                }
            }
        }
        catch (Exception ex)
        {
            LogException("Setup failed", ex);
            if (!silent)
            {
                MessageBox.Show(
                    "安装失败：\n" + ex.Message + "\n\n请把日志发给开发者：\n" + LogPath,
                    AppName,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
        }
    }

    private static void PerformInstall(InstallOptions options, Action<int, string> progress)
    {
        string appDir = Path.GetFullPath(options.Directory);
        string appPath = Path.Combine(appDir, AppName + ".exe");
        string uninstallPath = Path.Combine(appDir, "Uninstall.exe");
        string helpPath = Path.Combine(appDir, "help.note");
        string staging = Path.Combine(
            appDir,
            ".install-tmp-" + Guid.NewGuid().ToString("N"));
        Action<int, string> report = (value, text) =>
        {
            if (progress != null) progress(value, text);
        };

        Log("Install started. Target=" + appDir);
        SetLogTarget(appDir);
        Log("Log file: " + LogPath);
        try
        {
            report(5, "检查安装目录…");
            EnsureDirectoryWritable(appDir);
            CleanupInstallArtifacts(appDir);
            Directory.CreateDirectory(staging);
            string stagedApp = Path.Combine(staging, AppName + ".exe");
            string stagedUninstaller = Path.Combine(staging, "Uninstall.exe");
            string stagedHelp = Path.Combine(staging, "help.note");
            Extract("AppExe", stagedApp);
            Extract("Uninstaller", stagedUninstaller);
            Extract("HelpNote", stagedHelp);
            EnsureStagedFile(stagedApp);
            EnsureStagedFile(stagedUninstaller);
            EnsureStagedFile(stagedHelp);

            report(15, "检查磁盘空间…");
            uint freeSpace = GetFreeSpace(appDir);
            long required = new FileInfo(stagedApp).Length
                + new FileInfo(stagedUninstaller).Length
                + new FileInfo(stagedHelp).Length;
            if (freeSpace > 0 && freeSpace < (ulong)(required * 2))
            {
                throw new IOException("安装目录所在磁盘空间不足。");
            }

            report(22, "关闭正在运行的 Tauri Notes…");
            StopRunningApp(appDir);

            report(28, "复制应用文件…");
            InstallFile(stagedApp, appPath);
            report(42, "写入卸载程序…");
            InstallFile(stagedUninstaller, uninstallPath);
            report(52, "写入使用帮助…");
            InstallFile(stagedHelp, helpPath);

            report(60, "创建桌面快捷方式…");
            if (options.DesktopShortcut)
            {
                TryOptional("创建桌面快捷方式", delegate
                {
                    CreateShortcut(
                        Path.Combine(
                            Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                            AppName + ".lnk"),
                        appPath);
                }, options.Warnings);
            }

            report(76, "设置 .note 文件关联…");
            if (options.AssociateNote)
            {
                TryOptional("设置 .note 文件关联", delegate
                {
                    using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\.note")) key.SetValue("", ProgId);
                    using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\" + ProgId)) key.SetValue("", "Tauri Notes Knowledge Base");
                    using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\" + ProgId + @"\DefaultIcon")) key.SetValue("", "\"" + appPath + "\",0");
                    using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\" + ProgId + @"\shell\open\command")) key.SetValue("", "\"" + appPath + "\" \"%1\"");
                }, options.Warnings);
            }

            report(90, "完成安装…");
            RemoveLegacyUninstallEntry();

            report(100, "安装完成");
            Log("Install completed. Warnings=" + options.Warnings.Count);
        }
        catch (Exception ex)
        {
            LogException("Install failed", ex);
            throw;
        }
        finally
        {
            TryDeleteDirectory(staging);
        }
    }

    private static void EnsureStagedFile(string path)
    {
        if (!File.Exists(path))
        {
            throw new IOException("安装资源不完整：" + Path.GetFileName(path));
        }
        if (new FileInfo(path).Length == 0)
        {
            throw new IOException("安装资源为空：" + Path.GetFileName(path));
        }
    }

    private static void EnsureDirectoryWritable(string appDir)
    {
        Directory.CreateDirectory(appDir);
        string probe = Path.Combine(
            appDir,
            ".tauri-notes-write-" + Guid.NewGuid().ToString("N"));
        try
        {
            using (FileStream stream = new FileStream(
                probe,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None))
            {
                stream.WriteByte(1);
            }
        }
        catch (Exception ex)
        {
            throw new IOException(
                "无法写入安装目录：" + appDir + "\n请换一个目录，或检查杀毒软件/受控文件夹访问。",
                ex);
        }
        finally
        {
            TryDelete(probe);
        }
    }

    private static void CleanupInstallArtifacts(string appDir)
    {
        try
        {
            foreach (string directory in Directory.GetDirectories(appDir, ".install-tmp-*"))
            {
                TryDeleteDirectory(directory);
            }
            foreach (string file in Directory.GetFiles(appDir, "*.installing-*"))
            {
                TryDelete(file);
            }
            foreach (string file in Directory.GetFiles(appDir, "*.backup-*"))
            {
                TryDelete(file);
            }
        }
        catch
        {
            // Old artifacts must not block a fresh install.
        }
    }

    private static void RemoveLegacyUninstallEntry()
    {
        try
        {
            Registry.CurrentUser.DeleteSubKeyTree(
                @"Software\Microsoft\Windows\CurrentVersion\Uninstall\TauriNotes",
                false);
            Log("Removed legacy uninstall registry entry");
        }
        catch
        {
            // The key may not exist or may be read-only.
        }
    }

    private static uint GetFreeSpace(string path)
    {
        try
        {
            string root = Path.GetPathRoot(Path.GetFullPath(path));
            if (string.IsNullOrEmpty(root))
            {
                return 0;
            }
            return new DriveInfo(root).AvailableFreeSpace > uint.MaxValue
                ? uint.MaxValue
                : (uint)new DriveInfo(root).AvailableFreeSpace;
        }
        catch
        {
            return 0;
        }
    }

    private static void StopRunningApp(string appDir)
    {
        string expected = Path.GetFullPath(Path.Combine(appDir, AppName + ".exe"));
        foreach (Process process in Process.GetProcesses())
        {
            if (process.Id == Process.GetCurrentProcess().Id)
            {
                continue;
            }
            string name = "";
            string image = "";
            try
            {
                name = process.ProcessName;
                image = process.MainModule == null ? "" : process.MainModule.FileName;
            }
            catch
            {
                // Access can be denied for elevated or protected processes.
            }
            bool matchesName = name.Equals(AppName, StringComparison.OrdinalIgnoreCase)
                || name.Equals("tauri-notes", StringComparison.OrdinalIgnoreCase);
            bool matchesPath = !string.IsNullOrEmpty(image)
                && string.Equals(Path.GetFullPath(image), expected, StringComparison.OrdinalIgnoreCase);
            if (!matchesName && !matchesPath)
            {
                continue;
            }
            try
            {
                Log("Stopping running process: " + process.Id + " " + name + " " + image);
                process.Kill();
                process.WaitForExit(5000);
            }
            catch (Exception ex)
            {
                LogException("Could not stop running process " + process.Id, ex);
            }
        }
    }

    private static void InstallFile(string stagedPath, string targetPath)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(targetPath));
        Exception last = null;
        for (int attempt = 1; attempt <= 3; attempt += 1)
        {
            string temporary = targetPath + ".installing-" + Guid.NewGuid().ToString("N");
            try
            {
                File.Copy(stagedPath, temporary, true);
                if (File.Exists(targetPath))
                {
                    File.SetAttributes(targetPath, FileAttributes.Normal);
                    string backup = targetPath + ".backup-" + Guid.NewGuid().ToString("N");
                    try
                    {
                        File.Replace(temporary, targetPath, backup, true);
                    }
                    finally
                    {
                        TryDelete(backup);
                    }
                }
                else
                {
                    File.Move(temporary, targetPath);
                }
                Log("Installed file: " + targetPath);
                return;
            }
            catch (Exception ex)
            {
                last = ex;
                TryDelete(temporary);
                LogException("Install file attempt " + attempt + " failed: " + targetPath, ex);
                if (attempt == 1)
                {
                    StopRunningApp(Path.GetDirectoryName(targetPath));
                }
                Thread.Sleep(300 * attempt);
            }
        }
        throw new IOException(
            "无法写入文件：" + targetPath + "\n请关闭 Tauri Notes 后重试，或检查杀毒软件是否拦截。",
            last);
    }

    private static void TryOptional(string name, Action action, System.Collections.Generic.List<string> warnings)
    {
        try
        {
            action();
        }
        catch (Exception ex)
        {
            LogException(name + " failed", ex);
            warnings.Add(name + "：" + ex.Message);
        }
    }

    private static void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                File.SetAttributes(path, FileAttributes.Normal);
                File.Delete(path);
            }
        }
        catch
        {
            // Best effort cleanup.
        }
    }

    private static void TryDeleteDirectory(string path)
    {
        try
        {
            if (Directory.Exists(path))
            {
                Directory.Delete(path, true);
            }
        }
        catch
        {
            // Best effort cleanup.
        }
    }

    private sealed class InstallOptions
    {
        public string Directory;
        public bool DesktopShortcut;
        public bool AssociateNote;
        public bool NoLaunch;
        public List<string> Warnings = new List<string>();
    }

    private const int CsDropShadow = 0x00020000;

    private static GraphicsPath RoundedPath(Rectangle bounds, int radius)
    {
        int diameter = radius * 2;
        GraphicsPath path = new GraphicsPath();
        path.AddArc(bounds.Left, bounds.Top, diameter, diameter, 180, 90);
        path.AddArc(bounds.Right - diameter, bounds.Top, diameter, diameter, 270, 90);
        path.AddArc(bounds.Right - diameter, bounds.Bottom - diameter, diameter, diameter, 0, 90);
        path.AddArc(bounds.Left, bounds.Bottom - diameter, diameter, diameter, 90, 90);
        path.CloseFigure();
        return path;
    }

    private class ModernForm : Form
    {
        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams parameters = base.CreateParams;
                parameters.ClassStyle |= CsDropShadow;
                return parameters;
            }
        }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            using (GraphicsPath path = RoundedPath(
                new Rectangle(0, 0, Width, Height), 12))
            {
                Region = new Region(path);
            }
        }
    }

    private static InstallOptions AskOptions(string defaultDir)
    {
        Color accent = Color.FromArgb(47, 140, 255);
        Color dark = Color.FromArgb(31, 41, 55);
        Color muted = Color.FromArgb(107, 114, 128);
        Color page = Color.FromArgb(246, 248, 252);
        InstallOptions result = null;

        using (ModernForm form = new ModernForm())
        {
            form.Text = "Tauri Notes 安装";
            form.ClientSize = new Size(640, 420);
            form.FormBorderStyle = FormBorderStyle.None;
            form.StartPosition = FormStartPosition.CenterScreen;
            form.BackColor = page;
            form.ForeColor = dark;
            form.Font = new Font("Microsoft YaHei UI", 9F);
            form.KeyPreview = true;
            form.Paint += delegate(object sender, PaintEventArgs e)
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using (GraphicsPath border = RoundedPath(
                    new Rectangle(0, 0, form.Width - 1, form.Height - 1), 12))
                using (Pen pen = new Pen(Color.FromArgb(198, 209, 226), 1.2f))
                {
                    e.Graphics.DrawPath(pen, border);
                }
            };

            Color closeBase = Color.White;
            Label close = new Label
            {
                Text = "✕",
                Location = new Point(598, 8),
                Size = new Size(32, 32),
                TextAlign = ContentAlignment.MiddleCenter,
                BackColor = page,
                ForeColor = closeBase,
                Font = new Font("Segoe UI", 11F),
                Cursor = Cursors.Hand,
                TabStop = false,
                Visible = false
            };
            close.MouseEnter += delegate { close.ForeColor = Color.FromArgb(150, 196, 255); };
            close.MouseLeave += delegate { close.ForeColor = closeBase; };
            close.Click += delegate { form.DialogResult = DialogResult.Cancel; };
            form.KeyDown += delegate(object sender, KeyEventArgs e)
            {
                if (e.KeyCode == Keys.Escape)
                {
                    form.DialogResult = DialogResult.Cancel;
                }
            };

            Panel quickPage = new Panel { Dock = DockStyle.Fill, BackColor = page };
            Panel hero = new Panel { Dock = DockStyle.Top, Height = 300 };
            hero.Paint += delegate(object sender, PaintEventArgs e)
            {
                using (LinearGradientBrush brush = new LinearGradientBrush(
                    hero.ClientRectangle,
                    Color.FromArgb(58, 166, 255),
                    Color.FromArgb(35, 105, 225),
                    LinearGradientMode.Vertical))
                {
                    e.Graphics.FillRectangle(brush, hero.ClientRectangle);
                }
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                int cx = hero.Width / 2;
                int cy = 208;
                using (Pen ring = new Pen(Color.FromArgb(62, 255, 255, 255), 1.2f))
                {
                    for (int i = 0; i < 3; i++)
                    {
                        int radius = 72 + i * 34;
                        e.Graphics.DrawEllipse(ring, cx - radius, cy - radius / 3,
                            radius * 2, radius * 2 / 3);
                    }
                }
                using (SolidBrush platform = new SolidBrush(Color.FromArgb(215, 255, 255, 255)))
                {
                    e.Graphics.FillEllipse(platform, cx - 112, cy - 22, 224, 44);
                }
                using (SolidBrush glow = new SolidBrush(Color.FromArgb(95, 255, 255, 255)))
                {
                    e.Graphics.FillEllipse(glow, cx - 84, cy - 12, 168, 24);
                }
                int closeX = hero.Width - 42;
                using (Pen closePen = new Pen(Color.White, 2.2f))
                {
                    closePen.StartCap = LineCap.Round;
                    closePen.EndCap = LineCap.Round;
                    e.Graphics.DrawLine(closePen, closeX, 16, closeX + 14, 30);
                    e.Graphics.DrawLine(closePen, closeX + 14, 16, closeX, 30);
                }
            };
            hero.MouseMove += delegate(object sender, MouseEventArgs e)
            {
                Rectangle closeArea = new Rectangle(hero.Width - 50, 6, 44, 44);
                hero.Cursor = closeArea.Contains(e.Location) ? Cursors.Hand : Cursors.Default;
            };
            hero.MouseDown += delegate(object sender, MouseEventArgs e)
            {
                Rectangle closeArea = new Rectangle(hero.Width - 50, 6, 44, 44);
                if (e.Button == MouseButtons.Left && closeArea.Contains(e.Location))
                {
                    form.DialogResult = DialogResult.Cancel;
                    return;
                }
                if (e.Button == MouseButtons.Left)
                {
                    ReleaseCapture();
                    SendMessage(form.Handle, 0xA1, (IntPtr)0x2, IntPtr.Zero);
                }
            };

            Label brand = new Label
            {
                Text = "TAURI NOTES",
                AutoSize = true,
                Location = new Point(32, 26),
                Font = new Font("Microsoft YaHei UI", 15F, FontStyle.Bold),
                ForeColor = Color.White,
                BackColor = Color.Transparent
            };
            Label brandSub = new Label
            {
                Text = "本地优先的 Markdown 知识库",
                AutoSize = true,
                Location = new Point(34, 60),
                ForeColor = Color.FromArgb(225, 238, 255),
                BackColor = Color.Transparent
            };
            PictureBox icon = new PictureBox
            {
                Location = new Point(288, 86),
                Size = new Size(64, 64),
                SizeMode = PictureBoxSizeMode.Zoom,
                BackColor = Color.Transparent
            };
            try { icon.Image = LoadInstallerIcon(); } catch { }
            Label caption = new Label
            {
                Text = "Tauri Notes",
                AutoSize = false,
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(220, 154),
                Size = new Size(200, 28),
                Font = new Font("Microsoft YaHei UI", 14F, FontStyle.Bold),
                ForeColor = Color.White,
                BackColor = Color.Transparent
            };
            Label version = new Label
            {
                Text = "安装向导",
                AutoSize = false,
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(220, 182),
                Size = new Size(200, 20),
                ForeColor = Color.FromArgb(220, 235, 255),
                BackColor = Color.Transparent
            };
            hero.Controls.Add(brand);
            hero.Controls.Add(brandSub);
            hero.Controls.Add(icon);
            hero.Controls.Add(caption);
            hero.Controls.Add(version);

            Panel card = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 120,
                BackColor = Color.White
            };
            Button quickInstall = new Button
            {
                Text = "快速安装",
                Location = new Point(130, 22),
                Size = new Size(380, 44),
                FlatStyle = FlatStyle.Flat,
                BackColor = accent,
                ForeColor = Color.White,
                Font = new Font("Microsoft YaHei UI", 11F, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            quickInstall.FlatAppearance.BorderSize = 0;
            LinkLabel custom = new LinkLabel
            {
                Text = "⚙  自定义选项",
                AutoSize = true,
                Location = new Point(514, 82),
                LinkColor = Color.FromArgb(75, 85, 99),
                ActiveLinkColor = accent,
                VisitedLinkColor = Color.FromArgb(75, 85, 99),
                LinkBehavior = LinkBehavior.HoverUnderline,
                BackColor = Color.White
            };
            card.Controls.Add(quickInstall);
            card.Controls.Add(custom);
            quickPage.Controls.Add(hero);
            quickPage.Controls.Add(card);

            Panel detailPage = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = page,
                Visible = false
            };
            Panel detailHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 150
            };
            detailHeader.Paint += delegate(object sender, PaintEventArgs e)
            {
                using (LinearGradientBrush brush = new LinearGradientBrush(
                    detailHeader.ClientRectangle,
                    Color.FromArgb(58, 166, 255),
                    Color.FromArgb(35, 105, 225),
                    LinearGradientMode.Vertical))
                {
                    e.Graphics.FillRectangle(brush, detailHeader.ClientRectangle);
                }
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                int closeX = detailHeader.Width - 42;
                using (Pen closePen = new Pen(Color.White, 2.2f))
                {
                    closePen.StartCap = LineCap.Round;
                    closePen.EndCap = LineCap.Round;
                    e.Graphics.DrawLine(closePen, closeX, 16, closeX + 14, 30);
                    e.Graphics.DrawLine(closePen, closeX + 14, 16, closeX, 30);
                }
            };
            detailHeader.MouseMove += delegate(object sender, MouseEventArgs e)
            {
                Rectangle closeArea = new Rectangle(detailHeader.Width - 50, 6, 44, 44);
                detailHeader.Cursor = closeArea.Contains(e.Location) ? Cursors.Hand : Cursors.Default;
            };
            detailHeader.MouseDown += delegate(object sender, MouseEventArgs e)
            {
                Rectangle closeArea = new Rectangle(detailHeader.Width - 50, 6, 44, 44);
                if (e.Button == MouseButtons.Left && closeArea.Contains(e.Location))
                {
                    form.DialogResult = DialogResult.Cancel;
                    return;
                }
                if (e.Button == MouseButtons.Left)
                {
                    ReleaseCapture();
                    SendMessage(form.Handle, 0xA1, (IntPtr)0x2, IntPtr.Zero);
                }
            };
            Label detailTitle = new Label
            {
                Text = "自定义安装",
                AutoSize = true,
                Location = new Point(58, 24),
                Font = new Font("Microsoft YaHei UI", 18F, FontStyle.Bold),
                ForeColor = Color.White,
                BackColor = Color.Transparent
            };
            Label detailSub = new Label
            {
                Text = "选择安装位置和要创建的快捷方式。",
                AutoSize = true,
                Location = new Point(60, 62),
                ForeColor = Color.FromArgb(225, 238, 255),
                BackColor = Color.Transparent
            };
            Label directoryTitle = new Label
            {
                Text = "安装位置",
                AutoSize = true,
                Location = new Point(32, 164),
                Font = new Font("Microsoft YaHei UI", 10F, FontStyle.Bold),
                ForeColor = dark
            };
            TextBox pathBox = new TextBox
            {
                Text = defaultDir,
                Location = new Point(32, 188),
                Width = 470,
                Font = new Font("Microsoft YaHei UI", 10F),
                BorderStyle = BorderStyle.FixedSingle,
                BackColor = Color.White,
                ForeColor = dark
            };
            Button browse = new Button
            {
                Text = "浏览…",
                Location = new Point(514, 186),
                Size = new Size(92, 30),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.White,
                ForeColor = dark,
                Cursor = Cursors.Hand
            };
            browse.FlatAppearance.BorderColor = Color.FromArgb(203, 213, 225);
            browse.Click += delegate
            {
                using (FolderBrowserDialog dialog = new FolderBrowserDialog())
                {
                    dialog.Description = "选择 Tauri Notes 安装目录";
                    dialog.ShowNewFolderButton = true;
                    dialog.SelectedPath = pathBox.Text;
                    if (dialog.ShowDialog(form) == DialogResult.OK)
                    {
                        string selected = dialog.SelectedPath;
                        string trimmed = selected.TrimEnd('\\', '/');
                        bool alreadyNamed = string.Equals(
                            Path.GetFileName(trimmed),
                            "TauriNotes",
                            StringComparison.OrdinalIgnoreCase);
                        pathBox.Text = alreadyNamed
                            ? selected
                            : Path.Combine(selected, "TauriNotes");
                    }
                }
            };
            Label directoryHint = new Label
            {
                Text = "选择目录后会自动添加 TauriNotes 子目录。",
                AutoSize = true,
                Location = new Point(32, 224),
                ForeColor = muted
            };
            Label optionsTitle = new Label
            {
                Text = "安装选项",
                AutoSize = true,
                Location = new Point(32, 258),
                Font = new Font("Microsoft YaHei UI", 10F, FontStyle.Bold),
                ForeColor = dark
            };
            CheckBox desktop = new CheckBox
            {
                Text = "创建桌面快捷方式",
                Checked = false,
                AutoSize = true,
                Location = new Point(32, 288),
                ForeColor = dark,
                FlatStyle = FlatStyle.Flat
            };
            CheckBox associate = new CheckBox
            {
                Text = "将 .note 文件关联到 Tauri Notes",
                Checked = true,
                AutoSize = true,
                Location = new Point(32, 318),
                ForeColor = dark,
                FlatStyle = FlatStyle.Flat
            };
            LinkLabel back = new LinkLabel
            {
                Text = "<",
                AutoSize = false,
                Size = new Size(32, 32),
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(14, 8),
                Font = new Font("Segoe UI", 16F),
                LinkColor = Color.White,
                ActiveLinkColor = Color.FromArgb(190, 225, 255),
                VisitedLinkColor = Color.White,
                BackColor = Color.Transparent,
                Cursor = Cursors.Hand
            };
            Button install = new Button
            {
                Text = "安装",
                Location = new Point(510, 346),
                Size = new Size(100, 42),
                FlatStyle = FlatStyle.Flat,
                BackColor = accent,
                ForeColor = Color.White,
                Font = new Font("Microsoft YaHei UI", 10F, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            install.FlatAppearance.BorderSize = 0;
            detailHeader.Controls.Add(detailTitle);
            detailHeader.Controls.Add(detailSub);
            detailHeader.Controls.Add(back);
            detailPage.Controls.Add(detailHeader);
            detailPage.Controls.Add(directoryTitle);
            detailPage.Controls.Add(pathBox);
            detailPage.Controls.Add(browse);
            detailPage.Controls.Add(directoryHint);
            detailPage.Controls.Add(optionsTitle);
            detailPage.Controls.Add(desktop);
            detailPage.Controls.Add(associate);
            detailPage.Controls.Add(install);

            quickInstall.Click += delegate
            {
                result = new InstallOptions
                {
                    Directory = defaultDir,
                    DesktopShortcut = false,
                    AssociateNote = true
                };
                form.DialogResult = DialogResult.OK;
                form.Close();
            };
            custom.LinkClicked += delegate
            {
                quickPage.Visible = false;
                detailPage.Visible = true;
                detailPage.BringToFront();
                close.Visible = false;
                closeBase = Color.White;
                close.ForeColor = closeBase;
                close.BringToFront();
            };
            back.LinkClicked += delegate
            {
                detailPage.Visible = false;
                quickPage.Visible = true;
                quickPage.BringToFront();
                close.Visible = false;
                closeBase = Color.White;
                close.ForeColor = closeBase;
                close.BringToFront();
            };
            install.Click += delegate
            {
                string target = pathBox.Text.Trim();
                if (target.Length == 0)
                {
                    MessageBox.Show(form, "请选择安装目录。", "Tauri Notes 安装",
                        MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }
                try
                {
                    EnsureDirectoryWritable(target);
                }
                catch (Exception ex)
                {
                    MessageBox.Show(form,
                        "这个目录现在不能写入，请换一个目录。\n\n" + ex.Message,
                        "Tauri Notes 安装",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning);
                    return;
                }
                result = new InstallOptions
                {
                    Directory = target,
                    DesktopShortcut = desktop.Checked,
                    AssociateNote = associate.Checked
                };
                form.DialogResult = DialogResult.OK;
                form.Close();
            };

            form.Controls.Add(detailPage);
            form.Controls.Add(quickPage);
            form.Controls.Add(close);
            close.BringToFront();
            form.ShowDialog();
            return result;
        }
    }

    private static Image LoadInstallerIcon()
    {
        using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("AppIcon"))
        {
            if (stream == null)
            {
                return null;
            }
            using (Image source = Image.FromStream(stream))
            {
                return new Bitmap(source);
            }
        }
    }

    [DllImport("user32.dll")]
    private static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);

    private sealed class InstallProgressForm : ModernForm
    {
        private readonly InstallOptions options;
        private readonly Label status;
        private readonly TextBox detail;
        private readonly Panel fill;
        private readonly Label percent;
        private readonly Label close;
        private readonly Panel complete;
        private readonly CheckBox launch;
        private readonly Label headerTitle;
        private readonly Label headerSubtitle;
        private bool finished;

        public InstallProgressForm(InstallOptions options)
        {
            this.options = options;
            Text = "正在安装 Tauri Notes";
            ClientSize = new Size(580, 470);
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(246, 248, 252);
            ForeColor = Color.FromArgb(31, 41, 55);
            Font = new Font("Microsoft YaHei UI", 9F);
            ShowInTaskbar = true;

            Paint += delegate(object sender, PaintEventArgs e)
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using (GraphicsPath border = RoundedPath(new Rectangle(0, 0, Width - 1, Height - 1), 12))
                using (Pen pen = new Pen(Color.FromArgb(198, 209, 226), 1.2f))
                {
                    e.Graphics.DrawPath(pen, border);
                }
            };

            Panel header = new Panel { Dock = DockStyle.Top, Height = 118 };
            header.Paint += delegate(object sender, PaintEventArgs e)
            {
                using (LinearGradientBrush brush = new LinearGradientBrush(
                    header.ClientRectangle,
                    Color.FromArgb(58, 166, 255),
                    Color.FromArgb(35, 105, 225),
                    LinearGradientMode.Vertical))
                {
                    e.Graphics.FillRectangle(brush, header.ClientRectangle);
                }
            };
            header.MouseDown += delegate(object sender, MouseEventArgs e)
            {
                if (e.Button == MouseButtons.Left)
                {
                    ReleaseCapture();
                    SendMessage(Handle, 0xA1, (IntPtr)0x2, IntPtr.Zero);
                }
            };

            headerTitle = new Label
            {
                Text = "正在安装 Tauri Notes",
                AutoSize = true,
                Location = new Point(32, 28),
                Font = new Font("Microsoft YaHei UI", 17F, FontStyle.Bold),
                ForeColor = Color.White,
                BackColor = Color.Transparent
            };
            headerSubtitle = new Label
            {
                Text = "请稍候，安装即将完成",
                AutoSize = true,
                Location = new Point(34, 66),
                ForeColor = Color.FromArgb(225, 238, 255),
                BackColor = Color.Transparent
            };
            header.Controls.Add(headerTitle);
            header.Controls.Add(headerSubtitle);

            Panel body = new Panel { Dock = DockStyle.Fill, BackColor = Color.FromArgb(246, 248, 252) };
            status = new Label
            {
                Text = "准备安装…",
                AutoSize = false,
                Location = new Point(32, 20),
                Size = new Size(500, 28),
                Font = new Font("Microsoft YaHei UI", 14F, FontStyle.Bold),
                ForeColor = Color.FromArgb(31, 41, 55)
            };
            detail = new TextBox
            {
                Text = "正在准备安装环境",
                Location = new Point(34, 54),
                Size = new Size(500, 66),
                Multiline = true,
                ReadOnly = true,
                WordWrap = true,
                ScrollBars = ScrollBars.None,
                BorderStyle = BorderStyle.None,
                BackColor = Color.FromArgb(246, 248, 252),
                ForeColor = Color.FromArgb(107, 114, 128),
                TabStop = false
            };
            Panel track = new Panel
            {
                Location = new Point(32, 130),
                Size = new Size(516, 12),
                BackColor = Color.FromArgb(224, 231, 242)
            };
            fill = new Panel
            {
                Location = new Point(0, 0),
                Size = new Size(0, 12),
                BackColor = Color.FromArgb(47, 140, 255)
            };
            track.Controls.Add(fill);
            percent = new Label
            {
                Text = "0%",
                AutoSize = true,
                Location = new Point(32, 150),
                ForeColor = Color.FromArgb(107, 114, 128),
                Font = new Font("Microsoft YaHei UI", 9F)
            };

            complete = new Panel
            {
                Location = new Point(32, 188),
                Size = new Size(516, 100),
                Visible = false,
                BackColor = Color.Transparent
            };
            Label check = new Label
            {
                Text = "✓",
                AutoSize = true,
                Location = new Point(0, 4),
                Font = new Font("Segoe UI", 24F, FontStyle.Bold),
                ForeColor = Color.FromArgb(52, 168, 83)
            };
            Label installPath = new Label
            {
                Text = "安装位置：" + options.Directory,
                AutoEllipsis = true,
                Location = new Point(52, 12),
                Size = new Size(440, 22),
                ForeColor = Color.FromArgb(107, 114, 128),
                Font = new Font("Microsoft YaHei UI", 8.5F)
            };
            launch = new CheckBox
            {
                Text = "立即启动 Tauri Notes",
                Checked = true,
                AutoSize = true,
                Location = new Point(52, 46),
                ForeColor = Color.FromArgb(31, 41, 55),
                FlatStyle = FlatStyle.Flat
            };
            Button finish = new Button
            {
                Text = "完成",
                Location = new Point(410, 62),
                Size = new Size(86, 32),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(47, 140, 255),
                ForeColor = Color.White,
                Font = new Font("Microsoft YaHei UI", 9F, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            finish.FlatAppearance.BorderSize = 0;
            finish.Click += delegate
            {
                if (launch.Checked)
                {
                    try { Process.Start(Path.Combine(options.Directory, AppName + ".exe")); } catch { }
                }
                Close();
            };
            complete.Controls.Add(check);
            complete.Controls.Add(installPath);
            complete.Controls.Add(launch);
            complete.Controls.Add(finish);

            body.Controls.Add(status);
            body.Controls.Add(detail);
            body.Controls.Add(track);
            body.Controls.Add(percent);
            body.Controls.Add(complete);

            close = new Label
            {
                Text = "✕",
                Location = new Point(542, 10),
                Size = new Size(28, 28),
                TextAlign = ContentAlignment.MiddleCenter,
                BackColor = Color.Transparent,
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 11F),
                Cursor = Cursors.Hand,
                Visible = false
            };
            close.Click += delegate { Close(); };
            header.Controls.Add(close);

            Controls.Add(body);
            Controls.Add(header);
            Shown += delegate { StartInstall(); };
        }

        private void StartInstall()
        {
            Thread worker = new Thread(delegate()
            {
                try
                {
                    PerformInstall(options, delegate(int value, string text)
                    {
                        PostToUi(delegate { UpdateProgress(value, text); });
                    });
                    PostToUi(delegate { CompleteInstall(); });
                }
                catch (Exception ex)
                {
                    LogException("Installer worker failed", ex);
                    PostToUi(delegate { FailInstall(ex); });
                }
            });
            worker.IsBackground = true;
            worker.Name = "TauriNotesSetupWorker";
            worker.Start();
        }

        private void PostToUi(Action action)
        {
            try
            {
                if (!IsDisposed && IsHandleCreated)
                {
                    BeginInvoke(action);
                }
            }
            catch (Exception ex)
            {
                LogException("Could not marshal installer progress", ex);
            }
        }

        private void UpdateProgress(int value, string text)
        {
            if (finished || IsDisposed)
            {
                return;
            }
            status.Text = text;
            detail.ScrollBars = ScrollBars.None;
            detail.Text = value >= 100 ? "准备完成" : "正在执行安装步骤";
            fill.Width = Math.Max(0, Math.Min(516, 516 * value / 100));
            percent.Text = value + "%";
        }

        private void CompleteInstall()
        {
            finished = true;
            fill.BackColor = Color.FromArgb(52, 168, 83);
            percent.Text = "100%";
            Text = "安装完成";
            headerTitle.Text = "安装完成";
            headerSubtitle.Text = "Tauri Notes 已成功安装";
            status.Text = "安装完成";
            detail.ScrollBars = ScrollBars.None;
            detail.Text = options.Warnings.Count == 0
                ? "Tauri Notes 已成功安装。"
                : "安装完成，但有警告：" + options.Warnings[0];
            detail.ForeColor = options.Warnings.Count == 0
                ? Color.FromArgb(107, 114, 128)
                : Color.FromArgb(183, 121, 31);
            complete.Visible = true;
            close.Visible = true;
            Log("Installer UI completed. Warnings=" + options.Warnings.Count);
        }

        private void FailInstall(Exception ex)
        {
            finished = true;
            fill.BackColor = Color.FromArgb(220, 76, 84);
            fill.Width = 516;
            Text = "安装失败";
            headerTitle.Text = "安装失败";
            headerSubtitle.Text = "请检查错误信息后重试";
            status.Text = "安装失败";
            string message = ex.Message + "（日志：" + LogPath + "）";
            detail.ScrollBars = message.Length > 110
                ? ScrollBars.Vertical
                : ScrollBars.None;
            detail.Text = message;
            detail.SelectionStart = 0;
            detail.SelectionLength = 0;
            detail.ForeColor = Color.FromArgb(220, 76, 84);
            close.Visible = true;
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (!finished && e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                return;
            }
            base.OnFormClosing(e);
        }
    }

    private static void Extract(string resourceName, string target)
    {
        using (Stream input = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName))
        {
            if (input == null) throw new InvalidOperationException("missing resource " + resourceName);
            using (FileStream output = new FileStream(target, FileMode.Create, FileAccess.Write)) input.CopyTo(output);
        }
    }

    private static void CreateShortcut(string shortcutPath, string targetPath)
    {
        Type shellType = Type.GetTypeFromProgID("WScript.Shell");
        object shell = Activator.CreateInstance(shellType);
        object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
        Type shortcutType = shortcut.GetType();
        shortcutType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { targetPath });
        shortcutType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { Path.GetDirectoryName(targetPath) });
        shortcutType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
    }
}
