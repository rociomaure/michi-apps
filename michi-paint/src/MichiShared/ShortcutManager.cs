using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;
using Microsoft.Win32;

namespace MichiShared;

internal sealed class ShortcutManager : IDisposable
{
	public const int Off = -1;

	private static readonly (string Name, uint Mods)[] Presets = new(string, uint)[4]
	{
		("Ctrl + Shift", 6u),
		("Ctrl + Alt", 3u),
		("Ctrl + Alt + Shift", 7u),
		("Alt + Shift", 5u)
	};

	private readonly string app;

	private readonly string title;

	private readonly NotifyIcon tray;

	private readonly MichiShortcut[] shortcuts;

	private readonly Hotkeys hotkeys = new Hotkeys();

	private readonly List<ToolStripMenuItem> choiceItems = new List<ToolStripMenuItem>();

	private readonly HashSet<int> failed = new HashSet<int>();

	public int Preset { get; private set; }

	public ToolStripMenuItem MenuItem { get; }

	public ToolStripMenuItem StatusItem { get; }

	public bool AllOk
	{
		get
		{
			if (Preset != -1)
			{
				return failed.Count == 0;
			}
			return true;
		}
	}

	public event Action Changed;

	public ShortcutManager(string app, string title, NotifyIcon tray, MichiShortcut[] shortcuts, Action<int> onPressed)
	{
		this.app = app;
		this.title = title;
		this.tray = tray;
		this.shortcuts = shortcuts;
		hotkeys.Pressed += onPressed;
		MenuItem = new ToolStripMenuItem("Atajos de teclado");
		for (int i = 0; i < Presets.Length; i++)
		{
			int idx = i;
			ToolStripMenuItem val = new ToolStripMenuItem(Presets[i].Name + " + flechas" + ((i == 0) ? "   (recomendado)" : ""));
			((ToolStripItem)val).Click += delegate
			{
				Apply(idx, userInitiated: true);
			};
			choiceItems.Add(val);
			((ToolStripDropDownItem)MenuItem).DropDownItems.Add((ToolStripItem)(object)val);
		}
		((ToolStripDropDownItem)MenuItem).DropDownItems.Add((ToolStripItem)new ToolStripSeparator());
		ToolStripMenuItem val2 = new ToolStripMenuItem("Desactivados (usar solo el menú del gatito)");
		((ToolStripItem)val2).Click += delegate
		{
			Apply(-1, userInitiated: true);
		};
		choiceItems.Add(val2);
		((ToolStripDropDownItem)MenuItem).DropDownItems.Add((ToolStripItem)(object)val2);
		StatusItem = new ToolStripMenuItem("")
		{
			Visible = false,
			ForeColor = Color.FromArgb(180, 40, 30)
		};
		((ToolStripItem)StatusItem).Click += delegate
		{
			ShowProblem(dialog: true);
		};
		Preset = Load();
	}

	public string Label(int id)
	{
		MichiShortcut michiShortcut = shortcuts.First((MichiShortcut x) => x.Id == id);
		if (Preset == -1)
		{
			return "sin atajo";
		}
		if (failed.Contains(id))
		{
			return "atajo no disponible";
		}
		return Presets[Preset].Name + " + " + Arrow(michiShortcut.Key);
	}

	private static string Arrow(Keys k)
	{
		return k switch
		{
			Keys.Left => "←",
			Keys.Right => "→",
			Keys.Up => "↑",
			Keys.Down => "↓",
			_ => k.ToString(),
		};
	}

	public bool Apply(int preset, bool userInitiated)
	{
		hotkeys.RemoveAll();
		failed.Clear();
		Preset = preset;
		if (preset != -1)
		{
			MichiShortcut[] array = shortcuts;
			foreach (MichiShortcut michiShortcut in array)
			{
				if (!hotkeys.Add(michiShortcut.Id, Presets[preset].Mods, michiShortcut.Key))
				{
					failed.Add(michiShortcut.Id);
				}
			}
		}
		Save(preset);
		for (int j = 0; j < choiceItems.Count; j++)
		{
			choiceItems[j].Checked = ((j == choiceItems.Count - 1) ? (preset == -1) : (j == preset));
		}
		((ToolStripItem)StatusItem).Visible = !AllOk;
		((ToolStripItem)StatusItem).Text = (AllOk ? "" : $"⚠ {failed.Count} atajo(s) no disponible(s) — ver detalle");
		this.Changed?.Invoke();
		if (!AllOk)
		{
			ShowProblem(userInitiated);
		}
		else if (userInitiated)
		{
			tray.ShowBalloonTip(3000, title, (preset == -1) ? "Atajos desactivados. Usa el menú del gatito (clic derecho)." : ("Atajos activos: " + Presets[preset].Name + " + flechas."), (ToolTipIcon)1);
		}
		return AllOk;
	}

	private void ShowProblem(bool dialog)
	{
		if (!AllOk)
		{
			IEnumerable<string> values = from s in shortcuts
				where failed.Contains(s.Id)
				select $"• {s.Action}: {Presets[Preset].Name} + {Arrow(s.Key)}";
			string text = "Estos atajos no se pudieron activar porque otro programa (o Windows) ya los usa:\n\n" + string.Join("\n", values) + "\n\nPuedes elegir otra combinación en clic derecho en el gatito → \"Atajos de teclado\".\nMientras tanto, esas acciones funcionan desde el menú del gatito.";
			if (dialog)
			{
				MessageBox.Show(text, title + " — atajos no disponibles", (MessageBoxButtons)0, (MessageBoxIcon)48);
			}
			else
			{
				tray.ShowBalloonTip(10000, title + ": atajos no disponibles", "Otro programa ya usa " + Presets[Preset].Name + " + flechas. Clic derecho en el gatito → \"Atajos de teclado\" para cambiarlos.", (ToolTipIcon)2);
			}
		}
	}

	private int Load()
	{
		try
		{
			using RegistryKey registryKey = Registry.CurrentUser.OpenSubKey("Software\\MichiApps", writable: false);
			if (registryKey?.GetValue(app + "_atajos") is int num && num >= -1 && num < Presets.Length)
			{
				return num;
			}
		}
		catch
		{
		}
		return 0;
	}

	private void Save(int v)
	{
		try
		{
			using RegistryKey registryKey = Registry.CurrentUser.CreateSubKey("Software\\MichiApps");
			registryKey.SetValue(app + "_atajos", v, RegistryValueKind.DWord);
		}
		catch
		{
		}
	}

	public void Dispose()
	{
		hotkeys.Dispose();
	}
}
