using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace MichiPrint;

internal static class PawCursor
{
	private struct ICONINFO
	{
		public bool fIcon;

		public uint xHotspot;

		public uint yHotspot;

		public nint hbmMask;

		public nint hbmColor;
	}

	public static Bitmap Draw(int size)
	{
		Bitmap val = new Bitmap(size, size, (PixelFormat)2498570);
		Graphics val2 = Graphics.FromImage((Image)(object)val);
		try
		{
			val2.SmoothingMode = (SmoothingMode)4;
			float num = (float)size / 64f;
			val2.ScaleTransform(num, num);
			Color color = Color.FromArgb(255, 165, 60);
			Color color2 = Color.FromArgb(70, 40, 30);
			Color color3 = Color.FromArgb(255, 140, 160);
			Color color4 = Color.FromArgb(255, 250, 238);
			Pen val3 = new Pen(color2, 2.6f)
			{
				LineJoin = (LineJoin)2
			};
			try
			{
				GraphicsPath val4 = new GraphicsPath();
				try
				{
					val4.AddBezier(new PointF(3f, 3f), new PointF(16f, 6f), new PointF(26f, 14f), new PointF(32f, 22f));
					val4.AddLine(new PointF(32f, 22f), new PointF(22f, 32f));
					val4.AddBezier(new PointF(22f, 32f), new PointF(16f, 24f), new PointF(8f, 15f), new PointF(3f, 3f));
					val4.CloseFigure();
					SolidBrush val5 = new SolidBrush(color4);
					try
					{
						val2.FillPath((Brush)(object)val5, val4);
						val2.DrawPath(val3, val4);
					}
					finally
					{
						((IDisposable)val5)?.Dispose();
					}
				}
				finally
				{
					((IDisposable)val4)?.Dispose();
				}
				SolidBrush val6 = new SolidBrush(color);
				try
				{
					val2.FillEllipse((Brush)(object)val6, 18, 18, 44, 44);
					val2.DrawEllipse(val3, 18, 18, 44, 44);
				}
				finally
				{
					((IDisposable)val6)?.Dispose();
				}
				SolidBrush val7 = new SolidBrush(color3);
				try
				{
					val2.FillEllipse((Brush)(object)val7, 36, 37, 20, 18);
					PointF[] array = new PointF[4]
					{
						new PointF(29.2f, 47.8f),
						new PointF(30.7f, 37.7f),
						new PointF(37.7f, 30.7f),
						new PointF(47.8f, 29.2f)
					};
					for (int i = 0; i < array.Length; i++)
					{
						PointF pointF = array[i];
						val2.FillEllipse((Brush)(object)val7, pointF.X - 4.3f, pointF.Y - 4.3f, 8.6f, 8.6f);
					}
				}
				finally
				{
					((IDisposable)val7)?.Dispose();
				}
				return val;
			}
			finally
			{
				((IDisposable)val3)?.Dispose();
			}
		}
		finally
		{
			((IDisposable)val2)?.Dispose();
		}
	}

	public static Cursor Create(int dpi)
	{
		try
		{
			int num = Math.Max(32, (int)Math.Round((double)(48 * dpi) / 96.0));
			Bitmap val = Draw(num);
			try
			{
				nint hicon = val.GetHicon();
				if (!GetIconInfo(hicon, out var piconinfo))
				{
					DestroyIcon(hicon);
					return Cursors.Cross;
				}
				piconinfo.fIcon = false;
				piconinfo.xHotspot = (uint)Math.Round((double)(3 * num) / 64.0);
				piconinfo.yHotspot = (uint)Math.Round((double)(3 * num) / 64.0);
				nint num2 = CreateIconIndirect(ref piconinfo);
				DeleteObject(piconinfo.hbmColor);
				DeleteObject(piconinfo.hbmMask);
				DestroyIcon(hicon);
				return (Cursor)((num2 == IntPtr.Zero) ? ((object)Cursors.Cross) : ((object)new Cursor((IntPtr)num2)));
			}
			finally
			{
				((IDisposable)val)?.Dispose();
			}
		}
		catch
		{
			return Cursors.Cross;
		}
	}

	[DllImport("user32.dll")]
	private static extern bool GetIconInfo(nint hIcon, out ICONINFO piconinfo);

	[DllImport("user32.dll")]
	private static extern nint CreateIconIndirect(ref ICONINFO icon);

	[DllImport("user32.dll")]
	private static extern bool DestroyIcon(nint hIcon);

	[DllImport("gdi32.dll")]
	private static extern bool DeleteObject(nint hObject);
}
