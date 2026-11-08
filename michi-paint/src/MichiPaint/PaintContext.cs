using System;
using System.ComponentModel;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using MichiShared;

namespace MichiPaint;

internal sealed class PaintContext : ApplicationContext
{
	private const int HK_TOGGLE = 1;

	private const int HK_CLOSE = 2;

	private readonly NotifyIcon tray;

	private readonly ShortcutManager keys;

	private readonly ToolStripMenuItem drawItem;

	private readonly ToolStripMenuItem closeItem;

	private Overlay overlay;

	public static Icon AppIcon;

	public static string ToggleLabel = "";

	public static string CloseLabel = "";

	public PaintContext(bool firstRun)
	{
		using (Stream stream = typeof(PaintContext).Assembly.GetManifestResourceStream("michi.ico"))
		{
			AppIcon = (Icon)((stream == null) ? ((object)SystemIcons.Application) : ((object)new Icon(stream, 32, 32)));
		}
		ContextMenuStrip val = new ContextMenuStrip();
		drawItem = new ToolStripMenuItem("Dibujar / pausar", (Image)null, (EventHandler)delegate
		{
			Toggle();
		});
		closeItem = new ToolStripMenuItem("Borrar y cerrar dibujo", (Image)null, (EventHandler)delegate
		{
			EndSession();
		});
		((ToolStrip)val).Items.Add((ToolStripItem)(object)drawItem);
		((ToolStrip)val).Items.Add((ToolStripItem)(object)closeItem);
		((ToolStrip)val).Items.Add((ToolStripItem)new ToolStripSeparator());
		tray = new NotifyIcon
		{
			Icon = AppIcon,
			Text = "Michi Paint",
			ContextMenuStrip = val,
			Visible = true
		};
		tray.MouseClick += (MouseEventHandler)delegate(object? _, MouseEventArgs e)
		{
			if ((int)e.Button == 1048576)
			{
				Toggle();
			}
		};
		keys = new ShortcutManager("MichiPaint", "Michi Paint", tray, new MichiShortcut[2]
		{
			new MichiShortcut(1, (Keys)38, "Dibujar / pausar"),
			new MichiShortcut(2, (Keys)40, "Borrar y cerrar dibujo")
		}, delegate(int id)
		{
			switch (id)
			{
			case 1:
				Toggle();
				break;
			case 2:
				EndSession();
				break;
			}
		});
		keys.Changed += RefreshLabels;
		((ToolStrip)val).Items.Add((ToolStripItem)(object)keys.StatusItem);
		((ToolStrip)val).Items.Add((ToolStripItem)(object)keys.MenuItem);
		ToolStripMenuItem startup = new ToolStripMenuItem("Iniciar con Windows")
		{
			CheckOnClick = true,
			Checked = Startup.IsOn("MichiPaint")
		};
		startup.CheckedChanged += delegate
		{
			try
			{
				Startup.Set("MichiPaint", startup.Checked);
			}
			catch
			{
			}
		};
		((ToolStrip)val).Items.Add((ToolStripItem)(object)startup);
		((ToolStrip)val).Items.Add((ToolStripItem)new ToolStripSeparator());
		((ToolStrip)val).Items.Add("Salir", (Image)null, (EventHandler)delegate
		{
			base.ExitThread();
		});
		if (keys.Apply(keys.Preset, userInitiated: false) && firstRun && keys.Preset != -1)
		{
			tray.ShowBalloonTip(6000, "Michi Paint está listo \ud83c\udfa8", keys.Label(1) + " para dibujar o pausar · " + keys.Label(2) + " para borrar y cerrar.", (ToolTipIcon)0);
		}
	}

	private void RefreshLabels()
	{
		ToggleLabel = keys.Label(1);
		CloseLabel = keys.Label(2);
		((ToolStripItem)drawItem).Text = "Dibujar / pausar   (" + ToggleLabel + ")";
		((ToolStripItem)closeItem).Text = "Borrar y cerrar dibujo   (" + CloseLabel + ")";
		string text = (keys.AllOk ? ("Michi Paint \ud83c\udfa8 " + ((keys.Preset == -1) ? "(atajos desactivados)" : (ToggleLabel + " dibujar"))) : "Michi Paint — ⚠ atajos no disponibles");
		tray.Text = ((text.Length > 63) ? text.Substring(0, 63) : text);
	}

	public void Toggle()
	{
		if (overlay == null || ((Control)overlay).IsDisposed)
		{
			overlay = new Overlay(this);
			((Form)overlay).FormClosed += (FormClosedEventHandler)delegate
			{
				overlay = null;
			};
			overlay.Start();
		}
		else
		{
			overlay.SetPaused(!overlay.Paused);
		}
	}

	public void EndSession()
	{
		Overlay obj = overlay;
		if (obj != null)
		{
			((Form)obj).Close();
		}
		overlay = null;
	}

	protected override void ExitThreadCore()
	{
		EndSession();
		keys.Dispose();
		tray.Visible = false;
		((Component)(object)tray).Dispose();
		base.ExitThreadCore();
	}
}
