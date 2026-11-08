using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Windows.Forms;

namespace MichiPrint;

internal sealed class SelectionForm : Form
{
	private readonly Bitmap shot;

	private readonly Bitmap dim;

	private readonly Rectangle vs;

	private Point start;

	private Rectangle sel = Rectangle.Empty;

	private Rectangle lastDrawn = Rectangle.Empty;

	private bool dragging;

	private Cursor paw;

	public Bitmap Result { get; private set; }

	public SelectionForm()
	{
		vs = SystemInformation.VirtualScreen;
		shot = new Bitmap(vs.Width, vs.Height, (PixelFormat)2498570);
		Graphics val = Graphics.FromImage((Image)(object)shot);
		try
		{
			val.CopyFromScreen(vs.Left, vs.Top, 0, 0, vs.Size, (CopyPixelOperation)13369376);
		}
		finally
		{
			((IDisposable)val)?.Dispose();
		}
		dim = new Bitmap((Image)(object)shot);
		Graphics val2 = Graphics.FromImage((Image)(object)dim);
		try
		{
			SolidBrush val3 = new SolidBrush(Color.FromArgb(110, 0, 0, 0));
			try
			{
				val2.FillRectangle((Brush)(object)val3, 0, 0, ((Image)dim).Width, ((Image)dim).Height);
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
		base.AutoScaleMode = (AutoScaleMode)0;
		base.FormBorderStyle = (FormBorderStyle)0;
		base.StartPosition = (FormStartPosition)0;
		base.ShowInTaskbar = false;
		base.TopMost = true;
		base.DoubleBuffered = true;
		base.KeyPreview = true;
		base.Cursor = Cursors.Cross;
		base.Bounds = vs;
		base.Text = "Michi Print";
	}

	protected override void OnShown(EventArgs e)
	{
		base.OnShown(e);
		base.Bounds = vs;
		paw = PawCursor.Create(base.DeviceDpi);
		base.Cursor = paw;
	}

	protected override void WndProc(ref Message m)
	{
		if ((m).Msg == 736)
		{
			(m).Result = IntPtr.Zero;
		}
		else
		{
			base.WndProc(ref m);
		}
	}

	protected override void OnPaintBackground(PaintEventArgs e)
	{
	}

	protected override void OnPaint(PaintEventArgs e)
	{
		Graphics graphics = e.Graphics;
		Rectangle clipRectangle = e.ClipRectangle;
		graphics.DrawImage((Image)(object)dim, clipRectangle, clipRectangle, (GraphicsUnit)2);
		if (sel.Width > 0 && sel.Height > 0)
		{
			Rectangle rectangle = Rectangle.Intersect(sel, clipRectangle);
			if (!rectangle.IsEmpty)
			{
				graphics.DrawImage((Image)(object)shot, rectangle, rectangle, (GraphicsUnit)2);
			}
			Pen val = new Pen(Color.FromArgb(255, 165, 60), 2f);
			try
			{
				graphics.DrawRectangle(val, sel.X, sel.Y, sel.Width - 1, sel.Height - 1);
				string text = $"{sel.Width} × {sel.Height}";
				Font val2 = new Font("Segoe UI", 10f, (FontStyle)1, (GraphicsUnit)3);
				try
				{
					SizeF sizeF = graphics.MeasureString(text, val2);
					float num = sel.X;
					float num2 = (float)sel.Y - sizeF.Height - 4f;
					if (num2 < 0f)
					{
						num2 = sel.Y + 4;
					}
					SolidBrush val3 = new SolidBrush(Color.FromArgb(220, 70, 40, 30));
					try
					{
						graphics.FillRectangle((Brush)(object)val3, num, num2, sizeF.Width + 8f, sizeF.Height);
						graphics.DrawString(text, val2, Brushes.White, num + 4f, num2);
						return;
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
		string text2 = "Dibuja el rectángulo a copiar · Esc para cancelar";
		Font val4 = new Font("Segoe UI", 12f, (FontStyle)1, (GraphicsUnit)3);
		try
		{
			Point point = base.PointToClient(Cursor.Position);
			SizeF sizeF2 = graphics.MeasureString(text2, val4);
			SolidBrush val5 = new SolidBrush(Color.FromArgb(220, 70, 40, 30));
			try
			{
				graphics.FillRectangle((Brush)(object)val5, (float)(point.X + 18), (float)(point.Y + 18), sizeF2.Width + 10f, sizeF2.Height + 4f);
				graphics.DrawString(text2, val4, Brushes.White, (float)(point.X + 23), (float)(point.Y + 20));
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
	}

	private void Repaint()
	{
		Rectangle rectangle = Rectangle.Union(lastDrawn, sel);
		rectangle.Inflate(4, 40);
		base.Invalidate(rectangle);
		lastDrawn = sel;
	}

	protected override void OnMouseDown(MouseEventArgs e)
	{
		if ((int)e.Button == 2097152)
		{
			base.Close();
		}
		else if ((int)e.Button == 1048576)
		{
			base.Invalidate();
			dragging = true;
			start = e.Location;
			sel = new Rectangle(start, Size.Empty);
		}
	}

	protected override void OnMouseMove(MouseEventArgs e)
	{
		if (!dragging)
		{
			if (sel.IsEmpty)
			{
				base.Invalidate();
			}
			return;
		}
		int num = Math.Min(start.X, e.X);
		int num2 = Math.Min(start.Y, e.Y);
		int num3 = Math.Max(start.X, e.X);
		int num4 = Math.Max(start.Y, e.Y);
		sel = Rectangle.Intersect(new Rectangle(num, num2, num3 - num + 1, num4 - num2 + 1), new Rectangle(0, 0, ((Image)shot).Width, ((Image)shot).Height));
		Repaint();
	}

	protected override void OnMouseUp(MouseEventArgs e)
	{
		if (dragging && (int)e.Button == 1048576)
		{
			dragging = false;
			if (sel.Width >= 4 && sel.Height >= 4)
			{
				Result = shot.Clone(sel, (PixelFormat)2498570);
			}
			base.Close();
		}
	}

	protected override void OnKeyDown(KeyEventArgs e)
	{
		if ((int)e.KeyCode == 27)
		{
			base.Close();
		}
	}

	protected override void Dispose(bool disposing)
	{
		if (disposing)
		{
			((Image)shot).Dispose();
			((Image)dim).Dispose();
			if (paw != (Cursor)null && paw != Cursors.Cross)
			{
				paw.Dispose();
			}
		}
		base.Dispose(disposing);
	}
}
