using System;
using System.Drawing;
using System.Windows.Forms;

namespace MichiPaint;

internal sealed class TextEntry : Form
{
	private readonly TextBox box;

	private bool done;

	private nint previous;

	public event Action<string> Done;

	public TextEntry(Point screenPt, Color color, float px)
	{
		TextEntry textEntry = this;
		base.AutoScaleMode = (AutoScaleMode)0;
		base.FormBorderStyle = (FormBorderStyle)0;
		base.StartPosition = (FormStartPosition)0;
		base.ShowInTaskbar = false;
		base.TopMost = true;
		bool flag = (double)(int)color.R * 0.299 + (double)(int)color.G * 0.587 + (double)(int)color.B * 0.114 > 160.0;
		base.BackColor = Color.FromArgb(255, 165, 60);
		base.Padding = new Padding(2);
		box = new TextBox
		{
			BorderStyle = (BorderStyle)0,
			Font = new Font("Segoe UI", px, (FontStyle)1, (GraphicsUnit)2),
			ForeColor = color,
			BackColor = (flag ? Color.FromArgb(60, 45, 40) : Color.White),
			Dock = (DockStyle)5
		};
		base.Controls.Add((Control)(object)box);
		int height = ((TextBoxBase)box).PreferredHeight + 4;
		base.Bounds = new Rectangle(screenPt.X - 2, screenPt.Y - 2, (int)(px * 6f), height);
		((Control)box).TextChanged += delegate
		{
			int val = TextRenderer.MeasureText(((Control)textEntry.box).Text + "MM", ((Control)textEntry.box).Font).Width + 8;
			((Control)textEntry).Width = Math.Max((int)(px * 6f), val);
		};
		((Control)box).KeyDown += (KeyEventHandler)delegate(object? _, KeyEventArgs e)
		{
			if ((int)e.KeyCode == 13)
			{
				e.SuppressKeyPress = true;
				textEntry.Finish(((Control)textEntry.box).Text);
			}
			else if ((int)e.KeyCode == 27)
			{
				e.SuppressKeyPress = true;
				textEntry.Finish("");
			}
		};
		base.Deactivate += delegate
		{
			textEntry.Finish(((Control)textEntry.box).Text);
		};
	}

	protected override void OnShown(EventArgs e)
	{
		base.OnShown(e);
		previous = N.GetForegroundWindow();
		base.Activate();
		((Control)box).Focus();
	}

	private void Finish(string text)
	{
		if (done)
		{
			return;
		}
		done = true;
		this.Done?.Invoke(text);
		base.BeginInvoke((Action)delegate
		{
			base.Close();
			if (previous != IntPtr.Zero)
			{
				N.SetForegroundWindow(previous);
			}
		});
	}
}
