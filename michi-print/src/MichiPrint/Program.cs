using System;
using System.Threading;
using System.Windows.Forms;
using MichiShared;

namespace MichiPrint;

internal static class Program
{
	private const string MutexName = "Local\\MichiPrint_SingleInstance_v2";

	[STAThread]
	private static void Main()
	{
		Application.SetHighDpiMode((HighDpiMode)3);
		Application.EnableVisualStyles();
		Application.SetCompatibleTextRenderingDefault(false);
		bool createdNew;
		using (new Mutex(initiallyOwned: true, "Local\\MichiPrint_SingleInstance_v2", out createdNew))
		{
			if (!createdNew)
			{
				MessageBox.Show("Michi Print ya está funcionando.\nBusca el gatito junto al reloj (puede estar en la flechita ^).", "Michi Print", (MessageBoxButtons)0, (MessageBoxIcon)64);
				return;
			}
			Startup.RemoveOldVersionEntry("MichiPrint");
			bool num = Startup.IsFirstRun("MichiPrint");
			if (num)
			{
				Startup.AskOnFirstRun("MichiPrint", "Michi Print");
			}
			Application.Run((ApplicationContext)(object)new MichiContext(num));
		}
	}
}
