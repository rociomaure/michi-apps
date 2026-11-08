using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Linq;

namespace MichiPaint;

internal sealed class Stroke
{
	public Tool Tool;

	public Color Color;

	public float Width;

	public readonly List<Point> Pts = new List<Point>();

	public Point A;

	public Point B;

	public string Text;

	public float TextPx;

	private static bool IsLight(Color c)
	{
		return (double)(int)c.R * 0.299 + (double)(int)c.G * 0.587 + (double)(int)c.B * 0.114 > 160.0;
	}

	public void Draw(Graphics g)
	{
		g.SmoothingMode = (SmoothingMode)4;
		switch (Tool)
		{
		case Tool.Pen:
		case Tool.Marker:
		{
			Color color = ((Tool == Tool.Marker) ? Color.FromArgb(105, Color) : Color);
			if (Pts.Count == 1)
			{
				SolidBrush val6 = new SolidBrush(color);
				try
				{
					g.FillEllipse((Brush)(object)val6, (float)Pts[0].X - Width / 2f, (float)Pts[0].Y - Width / 2f, Width, Width);
					break;
				}
				finally
				{
					((IDisposable)val6)?.Dispose();
				}
			}
			if (Pts.Count > 1)
			{
				Pen val7 = new Pen(color, Width)
				{
					StartCap = (LineCap)2,
					EndCap = (LineCap)2,
					LineJoin = (LineJoin)2
				};
				try
				{
					g.DrawLines(val7, Pts.ToArray());
					break;
				}
				finally
				{
					((IDisposable)val7)?.Dispose();
				}
			}
			break;
		}
		case Tool.Arrow:
			if (!(A == B))
			{
				float num = Math.Max(Width, 4f);
				Pen val4 = new Pen(Color, num)
				{
					StartCap = (LineCap)2,
					LineJoin = (LineJoin)2
				};
				try
				{
					val4.CustomEndCap = (CustomLineCap)new AdjustableArrowCap(3.2f, 3.6f, true);
					g.DrawLine(val4, A, B);
					break;
				}
				finally
				{
					((IDisposable)val4)?.Dispose();
				}
			}
			break;
		case Tool.Rect:
		{
			Rectangle rectangle = Rectangle.FromLTRB(Math.Min(A.X, B.X), Math.Min(A.Y, B.Y), Math.Max(A.X, B.X), Math.Max(A.Y, B.Y));
			if (rectangle.Width >= 1 || rectangle.Height >= 1)
			{
				Pen val5 = new Pen(Color, Width)
				{
					LineJoin = (LineJoin)2
				};
				try
				{
					g.DrawRectangle(val5, rectangle);
					break;
				}
				finally
				{
					((IDisposable)val5)?.Dispose();
				}
			}
			break;
		}
		case Tool.Text:
		{
			if (string.IsNullOrWhiteSpace(Text))
			{
				break;
			}
			GraphicsPath val = TextPath();
			try
			{
				Pen val2 = new Pen(IsLight(Color) ? Color.FromArgb(220, 40, 25, 20) : Color.FromArgb(235, 255, 255, 255), Math.Max(3f, TextPx / 7f))
				{
					LineJoin = (LineJoin)2
				};
				try
				{
					g.DrawPath(val2, val);
					SolidBrush val3 = new SolidBrush(Color);
					try
					{
						g.FillPath((Brush)(object)val3, val);
						break;
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
			finally
			{
				((IDisposable)val)?.Dispose();
			}
		}
		}
	}

	private GraphicsPath TextPath()
	{
		GraphicsPath val = new GraphicsPath();
		FontFamily val2 = new FontFamily("Segoe UI");
		try
		{
			val.AddString(Text, val2, 1, TextPx, A, StringFormat.GenericTypographic);
			return val;
		}
		finally
		{
			((IDisposable)val2)?.Dispose();
		}
	}

	public Rectangle Bounds()
	{
		RectangleF value;
		float num5;
		switch (Tool)
		{
		case Tool.Text:
		{
			if (string.IsNullOrEmpty(Text))
			{
				return Rectangle.Empty;
			}
			GraphicsPath val = TextPath();
			try
			{
				value = val.GetBounds();
			}
			finally
			{
				((IDisposable)val)?.Dispose();
			}
			num5 = TextPx / 6f + 4f;
			break;
		}
		case Tool.Arrow:
		case Tool.Rect:
			value = RectangleF.FromLTRB(Math.Min(A.X, B.X), Math.Min(A.Y, B.Y), Math.Max(A.X, B.X), Math.Max(A.Y, B.Y));
			num5 = Math.Max(Width, 4f) * (float)((Tool != Tool.Arrow) ? 1 : 5) + 4f;
			break;
		default:
		{
			if (Pts.Count == 0)
			{
				return Rectangle.Empty;
			}
			int num = Pts.Min((Point p) => p.X);
			int num2 = Pts.Min((Point p) => p.Y);
			int num3 = Pts.Max((Point p) => p.X);
			int num4 = Pts.Max((Point p) => p.Y);
			value = RectangleF.FromLTRB(num, num2, num3, num4);
			num5 = Width + 4f;
			break;
		}
		}
		value.Inflate(num5, num5);
		return Rectangle.Round(value);
	}
}
