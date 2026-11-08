using System;
using System.IO;
using System.Windows.Forms;
using Microsoft.Win32;

namespace MichiShared;

internal static class Startup
{
	private const string RunKey = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";

	public const string AppKey = "Software\\MichiApps";

	private static string Exe => Environment.ProcessPath ?? Application.ExecutablePath;

	public static bool IsFirstRun(string app)
	{
		using RegistryKey registryKey = Registry.CurrentUser.OpenSubKey("Software\\MichiApps", writable: false);
		return registryKey?.GetValue(app + "_v2_configurado") == null;
	}

	public static void AskOnFirstRun(string app, string title)
	{
		string text = ((Exe.Contains("\\Temp\\", StringComparison.OrdinalIgnoreCase) || Exe.Contains("\\Downloads\\", StringComparison.OrdinalIgnoreCase) || Exe.Contains("\\Descargas\\", StringComparison.OrdinalIgnoreCase)) ? "\n\nOjo: lo estás abriendo desde Descargas o desde dentro del .zip. Si mueves la carpeta después, vuelve a activar esta opción desde el menú del gatito." : "");
		DialogResult val = MessageBox.Show("¿Quieres que " + title + " se abra solo cada vez que enciendas el computador?\n\nPuedes cambiarlo cuando quieras con clic derecho en el gatito → \"Iniciar con Windows\"." + text, title, (MessageBoxButtons)4, (MessageBoxIcon)32);
		try
		{
			Set(app, (int)val == 6);
		}
		catch
		{
		}
		try
		{
			using RegistryKey registryKey = Registry.CurrentUser.CreateSubKey("Software\\MichiApps");
			registryKey.SetValue(app + "_v2_configurado", 1);
		}
		catch
		{
		}
	}

	public static void Set(string app, bool on)
	{
		using RegistryKey registryKey = Registry.CurrentUser.OpenSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Run", writable: true) ?? Registry.CurrentUser.CreateSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Run");
		if (on)
		{
			registryKey.SetValue(app, "\"" + Exe + "\"");
		}
		else
		{
			registryKey.DeleteValue(app, throwOnMissingValue: false);
		}
	}

	public static bool IsOn(string app)
	{
		using RegistryKey registryKey = Registry.CurrentUser.OpenSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Run", writable: false);
		return registryKey?.GetValue(app) is string text && text.Trim('"').Equals(Exe, StringComparison.OrdinalIgnoreCase);
	}

	public static void RemoveOldVersionEntry(string app)
	{
		try
		{
			string value = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), app);
			using RegistryKey registryKey = Registry.CurrentUser.OpenSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Run", writable: true);
			if (registryKey?.GetValue(app) is string text && text.Trim('"').StartsWith(value, StringComparison.OrdinalIgnoreCase))
			{
				registryKey.DeleteValue(app, throwOnMissingValue: false);
			}
		}
		catch
		{
		}
	}
}
