using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Windows.Forms;

namespace MichiPaint;

internal static class PawCursor
{
	private static List<PointF> TailPoints()
	{
		List<PointF> pts = new List<PointF>();
		Bez(new PointF(7f, 7f), new PointF(4f, 30f), new PointF(40f, 14f), new PointF(38f, 36f), skipFirst: false);
		Bez(new PointF(38f, 36f), new PointF(37f, 50f), new PointF(50f, 58f), new PointF(60f, 57f), skipFirst: true);
		return pts;
		void Bez(PointF p0, PointF p1, PointF p2, PointF p3, bool skipFirst)
		{
			for (int i = (skipFirst ? 1 : 0); i <= 80; i++)
			{
				float num = (float)i / 80f;
				float num2 = 1f - num;
				pts.Add(new PointF(num2 * num2 * num2 * p0.X + 3f * num2 * num2 * num * p1.X + 3f * num2 * num * num * p2.X + num * num * num * p3.X, num2 * num2 * num2 * p0.Y + 3f * num2 * num2 * num * p1.Y + 3f * num2 * num * num * p2.Y + num * num * num * p3.Y));
			}
		}
	}

	public static Bitmap Draw(int size)
	{
		Bitmap val = new Bitmap(size, size, (PixelFormat)2498570);
		Graphics g = Graphics.FromImage((Image)(object)val);
		List<PointF> pts;
		int i;
		try
		{
			g.SmoothingMode = (SmoothingMode)4;
			float num = (float)size / 64f;
			g.ScaleTransform(num, num);
			Color color = Color.FromArgb(70, 40, 30);
			Color c2 = Color.FromArgb(201, 138, 72);
			Color c3 = Color.FromArgb(140, 86, 42);
			pts = TailPoints();
			i = pts.Count;
			Stroke(color, 7.5f, 14f, i);
			Stroke(c2, 3.5f, 9f, i);
			Stroke(c3, 3.5f, 9f, 14);
			Color color2 = Color.FromArgb(255, 120, 150);
			Pen val2 = new Pen(color, 1.2f)
			{
				LineJoin = (LineJoin)2
			};
			try
			{
				SolidBrush val3 = new SolidBrush(color2);
				try
				{
					PointF[] array = new PointF[3]
					{
						new PointF(50f, 55f),
						new PointF(43f, 49f),
						new PointF(43f, 60f)
					};
					PointF[] array2 = new PointF[3]
					{
						new PointF(50f, 55f),
						new PointF(56f, 47f),
						new PointF(57f, 58f)
					};
					g.FillPolygon((Brush)(object)val3, array);
					g.DrawPolygon(val2, array);
					g.FillPolygon((Brush)(object)val3, array2);
					g.DrawPolygon(val2, array2);
				}
				finally
				{
					((IDisposable)val3)?.Dispose();
				}
				SolidBrush val4 = new SolidBrush(Color.FromArgb(255, 90, 130));
				try
				{
					g.FillEllipse((Brush)(object)val4, 47.5f, 52.5f, 5f, 5f);
					g.DrawEllipse(val2, 47.5f, 52.5f, 5f, 5f);
				}
				finally
				{
					((IDisposable)val4)?.Dispose();
				}
				return val;
			}
			finally
			{
				((IDisposable)val2)?.Dispose();
			}
		}
		finally
		{
			if (g != null)
			{
				((IDisposable)g).Dispose();
			}
		}
		void Stroke(Color c, float w0, float w1, int count)
		{
			SolidBrush val5 = new SolidBrush(c);
			try
			{
				for (int j = 0; j < count; j++)
				{
					float num2 = (float)j / (float)(i - 1);
					float num3 = w0 + (w1 - w0) * Math.Min(1f, num2 * 1.6f);
					g.FillEllipse((Brush)(object)val5, pts[j].X - num3 / 2f, pts[j].Y - num3 / 2f, num3, num3);
				}
			}
			finally
			{
				((IDisposable)val5)?.Dispose();
			}
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
				if (!N.GetIconInfo(hicon, out var info))
				{
					N.DestroyIcon(hicon);
					return Cursors.Cross;
				}
				info.fIcon = false;
				info.xHotspot = (uint)Math.Round((double)(5 * num) / 64.0);
				info.yHotspot = (uint)Math.Round((double)(5 * num) / 64.0);
				nint num2 = N.CreateIconIndirect(ref info);
				N.DeleteObject(info.hbmColor);
				N.DeleteObject(info.hbmMask);
				N.DestroyIcon(hicon);
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
}
