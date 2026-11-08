using System;
using System.Threading;
using System.Windows.Forms;
using MichiShared;

namespace MichiPaint;

internal static class Program
{
	private const string MutexName = "Local\\MichiPaint_SingleInstance_v2";

	[STAThread]
	private static void Main()
	{
		Application.SetHighDpiMode((HighDpiMode)3);
		Application.EnableVisualStyles();
		Application.SetCompatibleTextRenderingDefault(false);
		bool createdNew;
		using (new Mutex(initiallyOwned: true, "Local\\MichiPaint_SingleInstance_v2", out createdNew))
		{
			if (!createdNew)
			{
				MessageBox.Show("Michi Paint ya está funcionando.\nBusca la gatita junto al reloj (puede estar en la flechita ^).", "Michi Paint", (MessageBoxButtons)0, (MessageBoxIcon)64);
				return;
			}
			Startup.RemoveOldVersionEntry("MichiPaint");
			bool num = Startup.IsFirstRun("MichiPaint");
			if (num)
			{
				Startup.AskOnFirstRun("MichiPaint", "Michi Paint");
			}
			Application.Run((ApplicationContext)(object)new PaintContext(num));
		}
	}
}
