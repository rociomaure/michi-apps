using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Windows.Forms;

namespace MichiPrint;

internal static class ClipboardHelper
{
	public static void SetImage(Bitmap bmp)
	{
		try
		{
			DataObject val = new DataObject();
			val.SetData(DataFormats.Bitmap, true, (object)bmp);
			MemoryStream memoryStream = new MemoryStream();
			((Image)bmp).Save((Stream)memoryStream, ImageFormat.Png);
			val.SetData("PNG", false, (object)memoryStream);
			Clipboard.SetDataObject((object)val, true, 10, 100);
		}
		catch
		{
			try
			{
				Clipboard.SetImage((Image)(object)bmp);
			}
			catch
			{
			}
		}
	}
}
