using System;
using System.ComponentModel;
using System.Drawing;
using System.Windows.Forms;

namespace MichiPrint;

internal sealed class Toast : Form
{
	private static Toast current;

	private readonly string text;

	private readonly Timer timer = new Timer
	{
		Interval = 1100
	};

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

	public static void Show(string text)
	{
		Toast toast = current;
		if (toast != null)
		{
			((Form)toast).Close();
		}
		current = new Toast(text);
		((Control)current).Show();
	}

	private Toast(string text)
	{
		this.text = text;
		base.AutoScaleMode = (AutoScaleMode)0;
		base.FormBorderStyle = (FormBorderStyle)0;
		base.StartPosition = (FormStartPosition)0;
		base.ShowInTaskbar = false;
		base.TopMost = true;
		base.BackColor = Color.FromArgb(70, 40, 30);
		Font val2 = (base.Font = new Font("Segoe UI", 11f, (FontStyle)1));
		Size size = TextRenderer.MeasureText(text, val2);
		base.Size = new Size(size.Width + 24, size.Height + 14);
		Point position = Cursor.Position;
		base.Location = new Point(position.X + 16, position.Y + 16);
		timer.Tick += delegate
		{
			base.Close();
		};
		timer.Start();
	}

	protected override void OnPaint(PaintEventArgs e)
	{
		TextRenderer.DrawText((IDeviceContext)(object)e.Graphics, text, base.Font, base.ClientRectangle, Color.White, (TextFormatFlags)5);
		Pen val = new Pen(Color.FromArgb(255, 165, 60), 2f);
		try
		{
			e.Graphics.DrawRectangle(val, 1, 1, base.Width - 3, base.Height - 3);
		}
		finally
		{
			((IDisposable)val)?.Dispose();
		}
	}

	protected override void OnFormClosed(FormClosedEventArgs e)
	{
		((Component)(object)timer).Dispose();
		if (current == this)
		{
			current = null;
		}
		base.OnFormClosed(e);
	}
}
