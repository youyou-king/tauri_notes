using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class Uninstall
{
    private const string AppName = "Tauri Notes";
    private const string ProgId = "TauriNotes.note";
    private const string AppDataFolder = "com.example.tauri-notes";
    private const int CsDropShadow = 0x00020000;

    [STAThread]
    private static void Main(string[] args)
    {
        bool silent = args.Length > 0 && args[0].Equals("/S", StringComparison.OrdinalIgnoreCase);
        bool progressTest = false;
        foreach (string arg in args)
        {
            if (arg.Equals("/PROGRESSTEST", StringComparison.OrdinalIgnoreCase)) progressTest = true;
        }
        bool deleteSettings = false;
        Application.EnableVisualStyles();

        if (progressTest)
        {
            using (UninstallProgressForm form = new UninstallProgressForm(false, true))
            {
                form.ShowDialog();
            }
            return;
        }

        if (!silent)
        {
            using (UninstallForm form = new UninstallForm())
            {
                if (form.ShowDialog() != DialogResult.OK)
                {
                    return;
                }
                deleteSettings = form.DeleteSettings;
            }

            using (UninstallProgressForm form = new UninstallProgressForm(deleteSettings))
            {
                form.ShowDialog();
            }
            ScheduleSelfDelete();
            return;
        }

        try
        {
            PerformUninstall(deleteSettings, null);
        }
        catch
        {
        }
        ScheduleSelfDelete();
    }

    private static void ScheduleSelfDelete()
    {
        string appDir = Path.GetDirectoryName(Application.ExecutablePath);
        // Delete only files owned by the app. A knowledge base saved next to the
        // executable must survive uninstall, so never use rd /s /q here.
        TryDelete(Path.Combine(appDir, AppName + ".exe"));
        TryDelete(Path.Combine(appDir, "help.note"));
        TryDelete(Path.Combine(appDir, "install.log"));
        TryDeleteDirectory(Path.Combine(appDir, "logs"));
        Process.Start(new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = "/c ping 127.0.0.1 -n 4 >nul & del /f /q \""
                + Path.Combine(appDir, AppName + ".exe")
                + "\" \"" + Path.Combine(appDir, "help.note")
                + "\" \"" + Path.Combine(appDir, "install.log")
                + "\" \"" + Path.Combine(appDir, "Uninstall.exe")
                + "\" & rmdir /s /q \"" + Path.Combine(appDir, "data")
                + "\" \"" + Path.Combine(appDir, "cache")
                + "\" \"" + Path.Combine(appDir, "logs")
                + "\" & rmdir \"" + appDir + "\"",
            CreateNoWindow = true,
            UseShellExecute = false,
            WorkingDirectory = Path.GetTempPath()
        });
    }

    private static void PerformUninstall(bool deleteSettings, Action<int, string> progress)
    {
        string appDir = Path.GetDirectoryName(Application.ExecutablePath);
        Action<int, string> report = (value, text) =>
        {
            if (progress != null) progress(value, text);
        };

        report(10, "关闭正在运行的程序…");
        foreach (Process process in Process.GetProcessesByName(AppName))
        {
            try { process.Kill(); process.WaitForExit(3000); } catch { }
        }
        foreach (Process process in Process.GetProcessesByName("tauri-notes"))
        {
            try { process.Kill(); process.WaitForExit(3000); } catch { }
        }

        report(30, "删除快捷方式…");
        TryDelete(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), AppName + ".lnk"));
        TryDelete(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), AppName + ".lnk"));

        report(55, "清除 .note 文件关联…");
        TryDeleteKey(@"Software\Classes\.note");
        TryDeleteKey(@"Software\Classes\" + ProgId);

        report(72, "删除卸载注册表项…");
        TryDeleteKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\TauriNotes");

        if (deleteSettings)
        {
            report(82, "删除应用设置、主题和缓存…");
            TryDeleteDirectory(Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                AppDataFolder));
            TryDeleteDirectory(Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                AppDataFolder));
        }

        // Installer logs and crash logs are application traces, not user notes.
        TryDeleteDirectory(Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "TauriNotes"));
        TryDelete(Path.Combine(Path.GetTempPath(), "TauriNotes-install.log"));
        TryDeleteDirectories(Path.Combine(Path.GetTempPath()), "TauriNotes-install-*");

        report(92, "清理安装目录…");
        if (!string.IsNullOrEmpty(appDir))
        {
            TryDelete(Path.Combine(appDir, AppName + ".exe"));
            TryDelete(Path.Combine(appDir, "help.note"));
            TryDelete(Path.Combine(appDir, "install.log"));
            TryDeleteDirectory(Path.Combine(appDir, "data"));
            TryDeleteDirectory(Path.Combine(appDir, "cache"));
            TryDeleteDirectory(Path.Combine(appDir, "logs"));
            TryDeleteDirectories(appDir, ".install-tmp-*");
            TryDeleteFiles(appDir, "*.installing-*");
            TryDeleteFiles(appDir, "*.backup-*");
        }

        report(100, "卸载完成");
    }

    private static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); } catch { }
    }

    private static void TryDeleteDirectory(string path)
    {
        try { if (Directory.Exists(path)) Directory.Delete(path, true); } catch { }
    }

    private static void TryDeleteDirectories(string parent, string pattern)
    {
        try
        {
            if (!Directory.Exists(parent))
            {
                return;
            }
            foreach (string directory in Directory.GetDirectories(parent, pattern))
            {
                TryDeleteDirectory(directory);
            }
        }
        catch { }
    }

    private static void TryDeleteFiles(string parent, string pattern)
    {
        try
        {
            if (!Directory.Exists(parent))
            {
                return;
            }
            foreach (string file in Directory.GetFiles(parent, pattern))
            {
                TryDelete(file);
            }
        }
        catch { }
    }

    private static void TryDeleteKey(string path)
    {
        try { Registry.CurrentUser.DeleteSubKeyTree(path, false); } catch { }
    }

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

    private sealed class UninstallForm : Form
    {
        private readonly Color background = Color.FromArgb(246, 248, 252);
        private readonly Color surface = Color.White;
        private readonly Color dark = Color.FromArgb(31, 41, 55);
        private readonly Color muted = Color.FromArgb(107, 114, 128);
        private readonly Color danger = Color.FromArgb(220, 76, 84);

        public bool DeleteSettings { get; private set; }

        public UninstallForm()
        {
            Text = "卸载 Tauri Notes";
            ClientSize = new Size(580, 420);
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = background;
            ForeColor = dark;
            Font = new Font("Microsoft YaHei UI", 9F);
            ShowInTaskbar = true;

            Paint += delegate(object sender, PaintEventArgs e)
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using (GraphicsPath border = RoundedPath(
                    new Rectangle(0, 0, Width - 1, Height - 1), 12))
                using (Pen pen = new Pen(Color.FromArgb(198, 209, 226), 1.2f))
                {
                    e.Graphics.DrawPath(pen, border);
                }
            };

            Panel header = new Panel { Dock = DockStyle.Top, Height = 160 };
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
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                int closeX = header.Width - 42;
                using (Pen closePen = new Pen(Color.White, 2.2f))
                {
                    closePen.StartCap = LineCap.Round;
                    closePen.EndCap = LineCap.Round;
                    e.Graphics.DrawLine(closePen, closeX, 16, closeX + 14, 30);
                    e.Graphics.DrawLine(closePen, closeX + 14, 16, closeX, 30);
                }
            };
            header.MouseMove += delegate(object sender, MouseEventArgs e)
            {
                Rectangle closeArea = new Rectangle(header.Width - 50, 6, 44, 44);
                header.Cursor = closeArea.Contains(e.Location) ? Cursors.Hand : Cursors.Default;
            };
            header.MouseDown += delegate(object sender, MouseEventArgs e)
            {
                Rectangle closeArea = new Rectangle(header.Width - 50, 6, 44, 44);
                if (e.Button == MouseButtons.Left && closeArea.Contains(e.Location))
                {
                    DialogResult = DialogResult.Cancel;
                    Close();
                    return;
                }
                if (e.Button == MouseButtons.Left)
                {
                    ReleaseCapture();
                    SendMessage(Handle, 0xA1, (IntPtr)0x2, IntPtr.Zero);
                }
            };

            PictureBox icon = new PictureBox
            {
                Location = new Point(28, 24),
                Size = new Size(44, 44),
                SizeMode = PictureBoxSizeMode.Zoom,
                BackColor = Color.Transparent
            };
            try
            {
                icon.Image = Icon.ExtractAssociatedIcon(Application.ExecutablePath).ToBitmap();
            }
            catch { }

            Label title = new Label
            {
                Text = "Tauri Notes",
                AutoSize = true,
                Location = new Point(86, 22),
                Font = new Font("Microsoft YaHei UI", 18F, FontStyle.Bold),
                ForeColor = Color.White,
                BackColor = Color.Transparent
            };
            Label subtitle = new Label
            {
                Text = "卸载向导",
                AutoSize = true,
                Location = new Point(88, 58),
                ForeColor = Color.FromArgb(225, 238, 255),
                BackColor = Color.Transparent
            };
            Label warning = new Label
            {
                Text = "知识库 .note 文件不会被删除",
                AutoSize = true,
                Location = new Point(28, 108),
                ForeColor = Color.FromArgb(235, 245, 255),
                BackColor = Color.Transparent
            };
            header.Controls.Add(icon);
            header.Controls.Add(title);
            header.Controls.Add(subtitle);
            header.Controls.Add(warning);

            Panel body = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = background
            };
            Label heading = new Label
            {
                Text = "准备卸载 Tauri Notes",
                AutoSize = true,
                Location = new Point(28, 20),
                Font = new Font("Microsoft YaHei UI", 15F, FontStyle.Bold),
                ForeColor = dark
            };
            Label description = new Label
            {
                Text = "将移除程序、桌面/开始菜单快捷方式和 .note 文件关联。",
                AutoSize = false,
                Location = new Point(30, 64),
                Size = new Size(500, 22),
                ForeColor = muted
            };
            Label description2 = new Label
            {
                Text = "你的知识库文件不会被删除。",
                AutoSize = true,
                Location = new Point(30, 88),
                ForeColor = muted
            };
            CheckBox settings = new CheckBox
            {
                Text = "同时删除应用设置、自定义主题和 WebView 缓存",
                Checked = true,
                AutoSize = true,
                Location = new Point(30, 124),
                ForeColor = dark,
                FlatStyle = FlatStyle.Flat
            };
            Label settingsPath = new Label
            {
                Text = "%APPDATA%\\com.example.tauri-notes",
                AutoSize = true,
                Location = new Point(48, 152),
                ForeColor = Color.FromArgb(148, 158, 176),
                Font = new Font("Microsoft YaHei UI", 8F)
            };
            body.Controls.Add(heading);
            body.Controls.Add(description);
            body.Controls.Add(description2);
            body.Controls.Add(settings);
            body.Controls.Add(settingsPath);

            Panel footer = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 72,
                BackColor = surface
            };
            footer.Paint += delegate(object sender, PaintEventArgs e)
            {
                using (SolidBrush line = new SolidBrush(Color.FromArgb(48, 56, 76)))
                {
                    e.Graphics.FillRectangle(line, 0, 0, footer.Width, 1);
                }
            };
            Button cancel = new Button
            {
                Text = "取消",
                Location = new Point(352, 18),
                Size = new Size(86, 36),
                FlatStyle = FlatStyle.Flat,
                BackColor = surface,
                ForeColor = dark,
                Cursor = Cursors.Hand,
                DialogResult = DialogResult.Cancel
            };
            cancel.FlatAppearance.BorderColor = Color.FromArgb(198, 209, 226);
            Button remove = new Button
            {
                Text = "卸载",
                Location = new Point(450, 18),
                Size = new Size(94, 36),
                FlatStyle = FlatStyle.Flat,
                BackColor = danger,
                ForeColor = Color.White,
                Font = new Font("Microsoft YaHei UI", 9F, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            remove.FlatAppearance.BorderSize = 0;
            remove.Click += delegate
            {
                DeleteSettings = settings.Checked;
                DialogResult = DialogResult.OK;
                Close();
            };
            footer.Controls.Add(cancel);
            footer.Controls.Add(remove);

            Controls.Add(body);
            Controls.Add(header);
            Controls.Add(footer);
            AcceptButton = remove;
            CancelButton = cancel;
            KeyPreview = true;
            KeyDown += delegate(object sender, KeyEventArgs e)
            {
                if (e.KeyCode == Keys.Escape)
                {
                    DialogResult = DialogResult.Cancel;
                }
            };
        }

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

    private sealed class UninstallProgressForm : Form
    {
        private readonly bool deleteSettings;
        private readonly bool preview;
        private readonly Label status;
        private readonly Label detail;
        private readonly Panel fill;
        private readonly Label percent;
        private readonly Label close;
        private readonly Panel complete;
        private readonly Label headerTitle;
        private readonly Label headerSubtitle;
        private bool finished;

        public UninstallProgressForm(bool deleteSettings, bool preview = false)
        {
            this.deleteSettings = deleteSettings;
            this.preview = preview;
            Text = "正在卸载 Tauri Notes";
            ClientSize = new Size(580, 400);
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
                Text = "正在卸载 Tauri Notes",
                AutoSize = true,
                Location = new Point(32, 28),
                Font = new Font("Microsoft YaHei UI", 17F, FontStyle.Bold),
                ForeColor = Color.White,
                BackColor = Color.Transparent
            };
            headerSubtitle = new Label
            {
                Text = "请稍候，正在清理安装内容",
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
                Text = "准备卸载…",
                AutoSize = false,
                Location = new Point(32, 20),
                Size = new Size(500, 28),
                Font = new Font("Microsoft YaHei UI", 14F, FontStyle.Bold),
                ForeColor = Color.FromArgb(31, 41, 55)
            };
            detail = new Label
            {
                Text = "正在准备清理",
                AutoSize = false,
                Location = new Point(34, 54),
                Size = new Size(500, 22),
                ForeColor = Color.FromArgb(107, 114, 128)
            };
            Panel track = new Panel
            {
                Location = new Point(32, 92),
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
                Location = new Point(32, 112),
                ForeColor = Color.FromArgb(107, 114, 128),
                Font = new Font("Microsoft YaHei UI", 9F)
            };

            complete = new Panel
            {
                Location = new Point(32, 150),
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
            Label note = new Label
            {
                Text = "知识库 .note 文件没有被删除。",
                AutoSize = true,
                Location = new Point(52, 12),
                ForeColor = Color.FromArgb(107, 114, 128)
            };
            Button finish = new Button
            {
                Text = "关闭",
                Location = new Point(410, 62),
                Size = new Size(86, 32),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(47, 140, 255),
                ForeColor = Color.White,
                Font = new Font("Microsoft YaHei UI", 9F, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            finish.FlatAppearance.BorderSize = 0;
            finish.Click += delegate { Close(); };
            complete.Controls.Add(check);
            complete.Controls.Add(note);
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
            Shown += delegate { StartUninstall(); };
        }

        private void StartUninstall()
        {
            try
            {
                if (preview)
                {
                    int[] values = { 12, 30, 52, 74, 92, 100 };
                    string[] labels = { "关闭正在运行的程序…", "删除快捷方式…", "清除 .note 文件关联…", "删除卸载注册表项…", "删除安装目录…", "卸载完成" };
                    for (int i = 0; i < values.Length; i++)
                    {
                        status.Text = labels[i];
                        detail.Text = values[i] >= 100 ? "清理完成" : "正在执行卸载步骤";
                        fill.Width = 516 * values[i] / 100;
                        percent.Text = values[i] + "%";
                        Application.DoEvents();
                        System.Threading.Thread.Sleep(160);
                    }
                }
                else
                {
                    PerformUninstall(deleteSettings, delegate(int value, string text)
                    {
                        status.Text = text;
                        detail.Text = value >= 100 ? "清理完成" : "正在执行卸载步骤";
                        fill.Width = Math.Max(0, Math.Min(516, 516 * value / 100));
                        percent.Text = value + "%";
                        Application.DoEvents();
                        System.Threading.Thread.Sleep(140);
                    });
                }
                finished = true;
                fill.BackColor = Color.FromArgb(52, 168, 83);
                percent.Text = "100%";
                Text = "卸载完成";
                headerTitle.Text = "卸载完成";
                headerSubtitle.Text = "Tauri Notes 已从这台电脑移除";
                status.Text = "卸载完成";
                detail.Text = "Tauri Notes 已从这台电脑移除。";
                complete.Visible = true;
                close.Visible = true;
            }
            catch (Exception ex)
            {
                finished = true;
                fill.BackColor = Color.FromArgb(220, 76, 84);
                fill.Width = 516;
                Text = "卸载失败";
                headerTitle.Text = "卸载失败";
                headerSubtitle.Text = "请检查错误信息后重试";
                status.Text = "卸载失败";
                detail.Text = ex.Message;
                detail.ForeColor = Color.FromArgb(220, 76, 84);
                close.Visible = true;
            }
        }

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
            using (GraphicsPath path = RoundedPath(new Rectangle(0, 0, Width, Height), 12))
            {
                Region = new Region(path);
            }
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

    [DllImport("user32.dll")]
    private static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);
}
