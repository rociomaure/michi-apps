using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Linq;
using System.Windows.Forms;

namespace MichiPaint;

internal sealed class Toolbar : Form
{
	private enum Kind
	{
		Handle,
		Tool,
		Color,
		Size,
		Undo,
		Clear,
		Pause,
		Close,
		Gap
	}

	private sealed class Item
	{
		public Kind Kind;

		public int Arg;

		public Rectangle R;

		public string Tip;
	}

	private readonly Overlay ov;

	private readonly List<Item> items = new List<Item>();

	private readonly ToolTip tip = new ToolTip
	{
		InitialDelay = 350,
		ShowAlways = true
	};

	private Item hover;

	private float s;

	private static readonly Color Bg = Color.FromArgb(70, 40, 30);

	private static readonly Color Accent = Color.FromArgb(255, 165, 60);

	private static readonly Color Lilac = Color.FromArgb(185, 150, 235);

	protected override bool ShowWithoutActivation => true;

	protected override CreateParams CreateParams
	{
		get
		{
			CreateParams createParams = base.CreateParams;
			createParams.ExStyle |= 0x8000088;
			return createParams;
		}
	}

	public Toolbar(Overlay ov)
	{
		this.ov = ov;
		base.AutoScaleMode = (AutoScaleMode)0;
		base.FormBorderStyle = (FormBorderStyle)0;
		base.StartPosition = (FormStartPosition)0;
		base.ShowInTaskbar = false;
		base.TopMost = true;
		base.DoubleBuffered = true;
		base.BackColor = Bg;
		base.Text = "Michi Paint";
		Add(Kind.Handle, 0, "Arrástrame para mover la barra");
		Add(Kind.Gap);
		Add(Kind.Tool, 0, "Lápiz");
		Add(Kind.Tool, 1, "Destacador");
		Add(Kind.Tool, 2, "Flecha");
		Add(Kind.Tool, 3, "Rectángulo");
		Add(Kind.Tool, 4, "Texto (clic donde quieras escribir, Enter para terminar)");
		Add(Kind.Gap);
		string[] array = new string[6] { "Rojo", "Amarillo", "Verde", "Azul", "Negro", "Blanco" };
		for (int i = 0; i < Overlay.Palette.Length; i++)
		{
			Add(Kind.Color, i, array[i]);
		}
		Add(Kind.Gap);
		Add(Kind.Size, 0, "Fino");
		Add(Kind.Size, 1, "Medio");
		Add(Kind.Size, 2, "Grueso");
		Add(Kind.Gap);
		Add(Kind.Undo, 0, "Deshacer (Ctrl + Z)");
		Add(Kind.Clear, 0, "Borrar todo");
		Add(Kind.Gap);
		Add(Kind.Pause, 0, "Pausar: los dibujos quedan y puedes usar lo de abajo");
		Add(Kind.Close, 0, "Cerrar y borrar (Esc)");
	}

	private void Add(Kind k, int arg = 0, string t = null)
	{
		items.Add(new Item
		{
			Kind = k,
			Arg = arg,
			Tip = t
		});
	}

	protected override void OnHandleCreated(EventArgs e)
	{
		base.OnHandleCreated(e);
		Layout2();
	}

	private void Layout2()
	{
		s = (float)base.DeviceDpi / 96f;
		int num = (int)(38f * s);
		int num2 = (int)(10f * s);
		int num3 = (int)(8f * s);
		int num4 = num3;
		foreach (Item item in items)
		{
			if (item.Kind == Kind.Gap)
			{
				num4 += num2;
				continue;
			}
			int num5 = ((item.Kind == Kind.Color || item.Kind == Kind.Size) ? ((int)(30f * s)) : num);
			item.R = new Rectangle(num4, num3, num5, num);
			num4 += num5 + (int)(2f * s);
		}
		Rectangle workingArea = Screen.PrimaryScreen.WorkingArea;
		base.Size = new Size(num4 + num3, num + num3 * 2);
		base.Location = new Point(workingArea.X + (workingArea.Width - base.Width) / 2, workingArea.Y + (int)(14f * s));
		GraphicsPath val = Rounded(new Rectangle(0, 0, base.Width, base.Height), (int)(16f * s));
		try
		{
			base.Region = new Region(val);
		}
		finally
		{
			((IDisposable)val)?.Dispose();
		}
	}

	private static GraphicsPath Rounded(Rectangle r, int rad)
	{
		GraphicsPath val = new GraphicsPath();
		int num = rad * 2;
		val.AddArc(r.X, r.Y, num, num, 180f, 90f);
		val.AddArc(r.Right - num, r.Y, num, num, 270f, 90f);
		val.AddArc(r.Right - num, r.Bottom - num, num, num, 0f, 90f);
		val.AddArc(r.X, r.Bottom - num, num, num, 90f, 90f);
		val.CloseFigure();
		return val;
	}

	private bool IsActive(Item it)
	{
		return it.Kind switch
		{
			Kind.Tool => ov.Tool == (Tool)it.Arg && !ov.Paused, 
			Kind.Color => ov.ColorIndex == it.Arg, 
			Kind.Size => ov.SizeLevel == it.Arg, 
			Kind.Pause => ov.Paused, 
			_ => false, 
		};
	}

	protected override void OnPaint(PaintEventArgs e)
	{
		Graphics graphics = e.Graphics;
		graphics.SmoothingMode = (SmoothingMode)4;
		graphics.TextRenderingHint = (TextRenderingHint)3;
		Pen val = new Pen(Accent, 2f * s);
		try
		{
			GraphicsPath val2 = Rounded(new Rectangle(1, 1, base.Width - 3, base.Height - 3), (int)(15f * s));
			try
			{
				graphics.DrawPath(val, val2);
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
		foreach (Item item in items)
		{
			if (item.Kind == Kind.Gap)
			{
				continue;
			}
			Rectangle r = item.R;
			bool flag = IsActive(item);
			if (flag || hover == item)
			{
				SolidBrush val3 = new SolidBrush(flag ? Color.FromArgb((item.Kind != Kind.Color) ? 255 : 0, Accent) : Color.FromArgb(70, 255, 255, 255));
				try
				{
					GraphicsPath val4 = Rounded(Rectangle.Inflate(r, -(int)(2f * s), -(int)(2f * s)), (int)(8f * s));
					try
					{
						graphics.FillPath((Brush)(object)val3, val4);
					}
					finally
					{
						((IDisposable)val4)?.Dispose();
					}
				}
				finally
				{
					((IDisposable)val3)?.Dispose();
				}
			}
			DrawItem(graphics, item, r, flag);
		}
	}

	private void DrawItem(Graphics g, Item it, Rectangle r, bool active)
	{
		Color color = ((active && it.Kind != Kind.Color) ? Bg : Color.White);
		float num = (float)r.X + (float)r.Width / 2f;
		float num2 = (float)r.Y + (float)r.Height / 2f;
		switch (it.Kind)
		{
		case Kind.Handle:
			g.DrawIcon(PaintContext.AppIcon, Rectangle.Inflate(r, -(int)(4f * s), -(int)(4f * s)));
			break;
		case Kind.Tool:
			DrawToolGlyph(g, (Tool)it.Arg, num, num2, color);
			break;
		case Kind.Color:
		{
			float num4 = 18f * s;
			SolidBrush val3 = new SolidBrush(Overlay.Palette[it.Arg]);
			try
			{
				g.FillEllipse((Brush)(object)val3, num - num4 / 2f, num2 - num4 / 2f, num4, num4);
				Pen val4 = new Pen(active ? Accent : Color.FromArgb(150, 255, 255, 255), active ? (3f * s) : (1.2f * s));
				try
				{
					float num5 = (active ? (num4 + 7f * s) : num4);
					g.DrawEllipse(val4, num - num5 / 2f, num2 - num5 / 2f, num5, num5);
					break;
				}
				finally
				{
					((IDisposable)val4)?.Dispose();
				}
			}
			finally
			{
				((IDisposable)val3)?.Dispose();
			}
		}
		case Kind.Size:
		{
			float num3 = (new float[3] { 5f, 9f, 15f })[it.Arg] * s;
			SolidBrush val2 = new SolidBrush(color);
			try
			{
				g.FillEllipse((Brush)(object)val2, num - num3 / 2f, num2 - num3 / 2f, num3, num3);
				break;
			}
			finally
			{
				((IDisposable)val2)?.Dispose();
			}
		}
		case Kind.Undo:
			Glyph(g, "↶", num, num2, color, 17f);
			break;
		case Kind.Clear:
			Glyph(g, "\ud83d\uddd1", num, num2, color, 14f);
			break;
		case Kind.Pause:
		{
			if (ov.Paused)
			{
				Glyph(g, "▶", num, num2, color, 14f);
				break;
			}
			SolidBrush val = new SolidBrush(color);
			try
			{
				g.FillRectangle((Brush)(object)val, num - 6f * s, num2 - 7f * s, 4f * s, 14f * s);
				g.FillRectangle((Brush)(object)val, num + 2f * s, num2 - 7f * s, 4f * s, 14f * s);
				break;
			}
			finally
			{
				((IDisposable)val)?.Dispose();
			}
		}
		case Kind.Close:
			Glyph(g, "✕", num, num2, color, 15f);
			break;
		}
	}

	private void DrawToolGlyph(Graphics g, Tool t, float cx, float cy, Color fg)
	{
		Pen val = new Pen(fg, 2.2f * s)
		{
			StartCap = (LineCap)2,
			EndCap = (LineCap)2,
			LineJoin = (LineJoin)2
		};
		try
		{
			switch (t)
			{
			case Tool.Pen:
				Glyph(g, "✎", cx, cy, fg, 17f);
				break;
			case Tool.Marker:
			{
				Pen val3 = new Pen(Color.FromArgb(170, 255, 220, 0), 8f * s)
				{
					StartCap = (LineCap)2,
					EndCap = (LineCap)2
				};
				try
				{
					g.DrawLine(val3, cx - 9f * s, cy + 5f * s, cx + 9f * s, cy - 5f * s);
					break;
				}
				finally
				{
					((IDisposable)val3)?.Dispose();
				}
			}
			case Tool.Arrow:
			{
				Pen val2 = new Pen(fg, 2.4f * s)
				{
					StartCap = (LineCap)2
				};
				try
				{
					val2.CustomEndCap = (CustomLineCap)new AdjustableArrowCap(3f, 3f, true);
					g.DrawLine(val2, cx - 9f * s, cy + 8f * s, cx + 8f * s, cy - 8f * s);
					break;
				}
				finally
				{
					((IDisposable)val2)?.Dispose();
				}
			}
			case Tool.Rect:
				g.DrawRectangle(val, cx - 9f * s, cy - 7f * s, 18f * s, 14f * s);
				break;
			case Tool.Text:
				Glyph(g, "T", cx, cy, fg, 17f, bold: true);
				break;
			}
		}
		finally
		{
			((IDisposable)val)?.Dispose();
		}
	}

	private void Glyph(Graphics g, string text, float cx, float cy, Color c, float pt, bool bold = false)
	{
		Font val = new Font((text == "\ud83d\uddd1") ? "Segoe UI Emoji" : "Segoe UI Symbol", pt * s, (FontStyle)(bold ? 1 : 0), (GraphicsUnit)2);
		try
		{
			SolidBrush val2 = new SolidBrush(c);
			try
			{
				StringFormat val3 = new StringFormat
				{
					Alignment = (StringAlignment)1,
					LineAlignment = (StringAlignment)1
				};
				g.DrawString(text, val, (Brush)(object)val2, new PointF(cx, cy + 1f), val3);
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

	private Item HitTest(Point p)
	{
		return items.FirstOrDefault((Item i) => i.Kind != Kind.Gap && i.R.Contains(p));
	}

	protected override void OnMouseMove(MouseEventArgs e)
	{
		Item item = HitTest(e.Location);
		if (item != hover)
		{
			hover = item;
			tip.SetToolTip((Control)(object)this, item?.Tip ?? "");
			base.Invalidate();
		}
		base.Cursor = ((item != null && item.Kind == Kind.Handle) ? Cursors.SizeAll : Cursors.Hand);
	}

	protected override void OnMouseLeave(EventArgs e)
	{
		hover = null;
		base.Invalidate();
	}

	protected override void OnMouseDown(MouseEventArgs e)
	{
		if ((int)e.Button != 1048576)
		{
			return;
		}
		Item item = HitTest(e.Location);
		if (item == null || item.Kind == Kind.Handle)
		{
			N.ReleaseCapture();
			N.SendMessage(base.Handle, 161, 2, IntPtr.Zero);
			return;
		}
		switch (item.Kind)
		{
		case Kind.Tool:
			ov.SetTool((Tool)item.Arg);
			break;
		case Kind.Color:
			ov.SetColor(item.Arg);
			break;
		case Kind.Size:
			ov.SetSize(item.Arg);
			break;
		case Kind.Undo:
			ov.Undo();
			break;
		case Kind.Clear:
			ov.ClearAll();
			break;
		case Kind.Pause:
			ov.SetPaused(!ov.Paused);
			break;
		case Kind.Close:
			ov.CloseFromToolbar();
			return;
		}
		base.Invalidate();
	}

	protected override void WndProc(ref Message m)
	{
		if ((m).Msg == 33)
		{
			(m).Result = (IntPtr)3;
		}
		else if ((m).Msg == 736)
		{
			base.WndProc(ref m);
			base.BeginInvoke((Action)delegate
			{
				Point location = base.Location;
				Layout2();
				base.Location = location;
				base.Invalidate();
			});
		}
		else
		{
			base.WndProc(ref m);
		}
	}
}
