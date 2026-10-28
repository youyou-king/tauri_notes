using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class Setup
{
    private const string AppName = "Tauri Notes";
    private const string ProgId = "TauriNotes.note";

    [STAThread]
    private static void Main(string[] args)
    {
        bool silent = args.Length > 0 && args[0].Equals("/S", StringComparison.OrdinalIgnoreCase);
        Application.EnableVisualStyles();
        try
        {
            string defaultDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                "TauriNotes");
            using (RegistryKey existing = Registry.CurrentUser.OpenSubKey(
                @"Software\Microsoft\Windows\CurrentVersion\Uninstall\TauriNotes"))
            {
                if (existing != null)
                {
                    string location = existing.GetValue("InstallLocation") as string;
                    if (!string.IsNullOrWhiteSpace(location))
                    {
                        defaultDir = location;
                    }
                }
            }
            InstallOptions options = silent
                ? new InstallOptions
                {
                    Directory = defaultDir,
                    DesktopShortcut = true,
                    StartMenuShortcut = true,
                    AssociateNote = true
                }
                : AskOptions(defaultDir);
            if (options == null)
            {
                return;
            }
            string appDir = options.Directory;
            Directory.CreateDirectory(appDir);
            foreach (Process process in Process.GetProcessesByName(AppName))
            {
                try { process.Kill(); process.WaitForExit(3000); } catch { }
            }
            string appPath = Path.Combine(appDir, AppName + ".exe");
            string uninstallPath = Path.Combine(appDir, "Uninstall.exe");
            Extract("AppExe", appPath);
            Extract("Uninstaller", uninstallPath);
            if (options.StartMenuShortcut)
            {
                CreateShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), AppName + ".lnk"), appPath);
            }
            if (options.DesktopShortcut)
            {
                CreateShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), AppName + ".lnk"), appPath);
            }
            if (options.AssociateNote)
            {
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\.note")) key.SetValue("", ProgId);
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\" + ProgId)) key.SetValue("", "Tauri Notes Knowledge Base");
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\" + ProgId + @"\DefaultIcon")) key.SetValue("", "\"" + appPath + "\",0");
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\" + ProgId + @"\shell\open\command")) key.SetValue("", "\"" + appPath + "\" \"%1\"");
            }
            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\TauriNotes"))
            {
                key.SetValue("DisplayName", AppName);
                key.SetValue("DisplayVersion", "0.1.0");
                key.SetValue("Publisher", "Tauri Notes");
                key.SetValue("InstallLocation", appDir);
                key.SetValue("DisplayIcon", appPath);
                key.SetValue("UninstallString", "\"" + uninstallPath + "\"");
                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            }
            if (!silent) MessageBox.Show("Tauri Notes 安装完成。\n\n安装位置：\n" + appDir, AppName, MessageBoxButtons.OK, MessageBoxIcon.Information);
            try { Process.Start(appPath); } catch { }
        }
        catch (Exception ex)
        {
            if (!silent) MessageBox.Show("安装失败：\n" + ex.Message, AppName, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private sealed class InstallOptions
    {
        public string Directory;
        public bool DesktopShortcut;
        public bool StartMenuShortcut;
        public bool AssociateNote;
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

    private sealed class ModernForm : Form
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
                        pathBox.Text = dialog.SelectedPath;
                    }
                }
            };
            Label directoryHint = new Label
            {
                Text = "程序、卸载程序和快捷方式都会使用这个目录。",
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
            CheckBox startMenu = new CheckBox
            {
                Text = "创建开始菜单快捷方式",
                Checked = false,
                AutoSize = true,
                Location = new Point(250, 288),
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
            detailPage.Controls.Add(startMenu);
            detailPage.Controls.Add(associate);
            detailPage.Controls.Add(install);

            quickInstall.Click += delegate
            {
                result = new InstallOptions
                {
                    Directory = defaultDir,
                    DesktopShortcut = false,
                    StartMenuShortcut = false,
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
                result = new InstallOptions
                {
                    Directory = target,
                    DesktopShortcut = desktop.Checked,
                    StartMenuShortcut = startMenu.Checked,
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
