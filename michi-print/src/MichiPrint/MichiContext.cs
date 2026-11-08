using System;
using System.ComponentModel;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using MichiShared;

namespace MichiPrint;

internal sealed class MichiContext : ApplicationContext
{
	private const int HK_CUT = 1;

	private const int HK_PASTE = 2;

	private readonly NotifyIcon tray;

	private readonly ShortcutManager keys;

	private readonly ToolStripMenuItem cutItem;

	private readonly ToolStripMenuItem pasteItem;

	private readonly Timer pasteWait = new Timer
	{
		Interval = 25
	};

	private int pasteTicks;

	private Bitmap lastClip;

	private bool selecting;

	public MichiContext(bool firstRun)
	{
		Icon icon;
		using (Stream stream = typeof(MichiContext).Assembly.GetManifestResourceStream("michi.ico"))
		{
			icon = (Icon)((stream == null) ? ((object)SystemIcons.Application) : ((object)new Icon(stream, SystemInformation.SmallIconSize)));
		}
		ContextMenuStrip val = new ContextMenuStrip();
		cutItem = new ToolStripMenuItem("Recortar", (Image)null, (EventHandler)delegate
		{
			StartSelection();
		});
		pasteItem = new ToolStripMenuItem("Pegar recorte", (Image)null, (EventHandler)delegate
		{
			PasteClip();
		});
		((ToolStrip)val).Items.Add((ToolStripItem)(object)cutItem);
		((ToolStrip)val).Items.Add((ToolStripItem)(object)pasteItem);
		((ToolStrip)val).Items.Add((ToolStripItem)new ToolStripSeparator());
		tray = new NotifyIcon
		{
			Icon = icon,
			Text = "Michi Print",
			ContextMenuStrip = val,
			Visible = true
		};
		tray.MouseClick += (MouseEventHandler)delegate(object? _, MouseEventArgs e)
		{
			if ((int)e.Button == 1048576)
			{
				StartSelection();
			}
		};
		keys = new ShortcutManager("MichiPrint", "Michi Print", tray, new MichiShortcut[2]
		{
			new MichiShortcut(1, (Keys)37, "Recortar"),
			new MichiShortcut(2, (Keys)39, "Pegar recorte")
		}, delegate(int id)
		{
			switch (id)
			{
			case 1:
				StartSelection();
				break;
			case 2:
				PasteClip();
				break;
			}
		});
		keys.Changed += RefreshLabels;
		((ToolStrip)val).Items.Add((ToolStripItem)(object)keys.StatusItem);
		((ToolStrip)val).Items.Add((ToolStripItem)(object)keys.MenuItem);
		ToolStripMenuItem startupItem = new ToolStripMenuItem("Iniciar con Windows")
		{
			CheckOnClick = true,
			Checked = Startup.IsOn("MichiPrint")
		};
		startupItem.CheckedChanged += delegate
		{
			try
			{
				Startup.Set("MichiPrint", startupItem.Checked);
			}
			catch
			{
			}
		};
		((ToolStrip)val).Items.Add((ToolStripItem)(object)startupItem);
		((ToolStrip)val).Items.Add((ToolStripItem)new ToolStripSeparator());
		((ToolStrip)val).Items.Add("Salir", (Image)null, (EventHandler)delegate
		{
			base.ExitThread();
		});
		pasteWait.Tick += delegate
		{
			PasteWhenKeysReleased();
		};
		if (keys.Apply(keys.Preset, userInitiated: false) && firstRun && keys.Preset != -1)
		{
			tray.ShowBalloonTip(6000, "Michi Print está listo \ud83d\udc3e", keys.Label(1) + " para recortar · " + keys.Label(2) + " para pegar.", (ToolTipIcon)0);
		}
	}

	private void RefreshLabels()
	{
		((ToolStripItem)cutItem).Text = "Recortar   (" + keys.Label(1) + ")";
		((ToolStripItem)pasteItem).Text = "Pegar recorte   (" + keys.Label(2) + ")";
		string text = (keys.AllOk ? ("Michi Print \ud83d\udc3e " + ((keys.Preset == -1) ? "(atajos desactivados)" : (keys.Label(1) + " recortar"))) : "Michi Print — ⚠ atajos no disponibles");
		tray.Text = ((text.Length > 63) ? text.Substring(0, 63) : text);
	}

	private void StartSelection()
	{
		if (selecting)
		{
			return;
		}
		selecting = true;
		try
		{
			SelectionForm f = new SelectionForm();
			((Form)f).FormClosed += (FormClosedEventHandler)delegate
			{
				selecting = false;
				if (f.Result != null)
				{
					Bitmap obj2 = lastClip;
					if (obj2 != null)
					{
						((Image)obj2).Dispose();
					}
					lastClip = f.Result;
					ClipboardHelper.SetImage(lastClip);
					Toast.Show("Recorte copiado \ud83d\udc3e");
				}
				((Component)(object)f).Dispose();
			};
			((Control)f).Show();
			((Form)f).Activate();
		}
		catch
		{
			selecting = false;
		}
	}

	private void PasteClip()
	{
		if (lastClip == null)
		{
			Toast.Show("Aún no hay recorte \ud83d\udc3e");
			return;
		}
		ClipboardHelper.SetImage(lastClip);
		pasteTicks = 0;
		pasteWait.Start();
	}

	private void PasteWhenKeysReleased()
	{
		pasteTicks++;
		bool flag = Native.IsDown((Keys)17) || Native.IsDown((Keys)18) || Native.IsDown((Keys)16);
		if (!flag || pasteTicks >= 120)
		{
			pasteWait.Stop();
			if (flag)
			{
				Toast.Show("Recorte listo: pega con Ctrl + V");
			}
			else
			{
				Native.SendCtrlV();
			}
		}
	}

	protected override void ExitThreadCore()
	{
		((Component)(object)pasteWait).Dispose();
		keys.Dispose();
		tray.Visible = false;
		((Component)(object)tray).Dispose();
		base.ExitThreadCore();
	}
}
