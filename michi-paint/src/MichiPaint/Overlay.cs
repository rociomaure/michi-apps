using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace MichiPaint;

internal sealed class Overlay : Form
{
	public static readonly Color[] Palette = new Color[6]
	{
		Color.FromArgb(235, 50, 60),
		Color.FromArgb(255, 200, 0),
		Color.FromArgb(40, 185, 90),
		Color.FromArgb(40, 120, 235),
		Color.FromArgb(25, 25, 25),
		Color.FromArgb(255, 255, 255)
	};

	private readonly PaintContext ctx;

	private readonly Rectangle vs;

	private Rectangle full;

	private nint screenDC;

	private nint memDC;

	private nint hBmp;

	private nint oldBmp;

	private nint bits;

	private Bitmap surface;

	private Bitmap committed;

	private readonly List<Stroke> strokes = new List<Stroke>();

	private Stroke current;

	private Rectangle dirty = Rectangle.Empty;

	private Rectangle lastCurBounds = Rectangle.Empty;

	private readonly Timer frame = new Timer
	{
		Interval = 15
	};

	private readonly Timer keepTop = new Timer
	{
		Interval = 1500
	};

	private Toolbar toolbar;

	private TextEntry textEntry;

	private Cursor paw;

	private float scale = 1f;

	public bool Paused { get; private set; }

	public Tool Tool { get; private set; }

	public int ColorIndex { get; private set; }

	public int SizeLevel { get; private set; } = 1;


	protected override bool ShowWithoutActivation => true;

	protected override CreateParams CreateParams
	{
		get
		{
			CreateParams createParams = base.CreateParams;
			createParams.ExStyle |= 0x8080088;
			return createParams;
		}
	}

	private float PenWidth => (new float[3] { 3f, 6f, 12f })[SizeLevel] * scale;

	private float TextPx => (new float[3] { 22f, 34f, 52f })[SizeLevel] * scale;

	public Overlay(PaintContext ctx)
	{
		this.ctx = ctx;
		vs = SystemInformation.VirtualScreen;
		base.AutoScaleMode = (AutoScaleMode)0;
		base.FormBorderStyle = (FormBorderStyle)0;
		base.StartPosition = (FormStartPosition)0;
		base.ShowInTaskbar = false;
		base.TopMost = true;
		base.Bounds = vs;
		base.Text = "Michi Paint";
		frame.Tick += delegate
		{
			Flush();
		};
		keepTop.Tick += delegate
		{
			KeepOnTop();
		};
	}

	public void Start()
	{
		base.CreateHandle();
		N.SetWindowPos(base.Handle, N.HWND_TOPMOST, vs.X, vs.Y, vs.Width, vs.Height, 16u);
		scale = (float)base.DeviceDpi / 96f;
		AllocSurface();
		paw = PawCursor.Create(base.DeviceDpi);
		base.Cursor = paw;
		dirty = full;
		Flush();
		base.Show();
		N.SetWindowPos(base.Handle, N.HWND_TOPMOST, vs.X, vs.Y, vs.Width, vs.Height, 80u);
		Toolbar obj = new Toolbar(this);
		((Form)obj).Owner = (Form)(object)this;
		toolbar = obj;
		((Control)toolbar).Show();
		RegisterKeys(on: true);
		frame.Start();
		keepTop.Start();
	}

	private void AllocSurface()
	{
		full = new Rectangle(0, 0, vs.Width, vs.Height);
		screenDC = N.GetDC(IntPtr.Zero);
		memDC = N.CreateCompatibleDC(screenDC);
		N.BITMAPINFO bITMAPINFO = default(N.BITMAPINFO);
		bITMAPINFO.biSize = Marshal.SizeOf<N.BITMAPINFO>();
		bITMAPINFO.biWidth = vs.Width;
		bITMAPINFO.biHeight = -vs.Height;
		bITMAPINFO.biPlanes = 1;
		bITMAPINFO.biBitCount = 32;
		bITMAPINFO.biCompression = 0;
		N.BITMAPINFO bmi = bITMAPINFO;
		hBmp = N.CreateDIBSection(memDC, ref bmi, 0u, out bits, IntPtr.Zero, 0u);
		oldBmp = N.SelectObject(memDC, hBmp);
		surface = new Bitmap(vs.Width, vs.Height, vs.Width * 4, (PixelFormat)925707, (IntPtr)bits);
		committed = new Bitmap(vs.Width, vs.Height, (PixelFormat)925707);
	}

	private void RegisterKeys(bool on)
	{
		N.UnregisterHotKey(base.Handle, 1);
		N.UnregisterHotKey(base.Handle, 2);
		if (on)
		{
			N.RegisterHotKey(base.Handle, 1, 16384u, 27u);
			N.RegisterHotKey(base.Handle, 2, 16386u, 90u);
		}
	}

	protected override void WndProc(ref Message m)
	{
		if ((m).Msg == 736)
		{
			(m).Result = IntPtr.Zero;
		}
		else if ((m).Msg == 33)
		{
			(m).Result = (IntPtr)3;
		}
		else if ((m).Msg == 786)
		{
			switch ((int)(nint)(m).WParam)
			{
			case 1:
				ctx.EndSession();
				break;
			case 2:
				Undo();
				break;
			}
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
	}

	public void SetTool(Tool t)
	{
		Tool = t;
		base.Cursor = ((t == Tool.Text) ? Cursors.IBeam : paw);
		if (Paused)
		{
			SetPaused(p: false);
		}
		Toolbar obj = toolbar;
		if (obj != null)
		{
			((Control)obj).Invalidate();
		}
	}

	public void SetColor(int i)
	{
		ColorIndex = i;
		if (Paused)
		{
			SetPaused(p: false);
		}
		Toolbar obj = toolbar;
		if (obj != null)
		{
			((Control)obj).Invalidate();
		}
	}

	public void SetSize(int s)
	{
		SizeLevel = s;
		if (Paused)
		{
			SetPaused(p: false);
		}
		Toolbar obj = toolbar;
		if (obj != null)
		{
			((Control)obj).Invalidate();
		}
	}

	public void SetPaused(bool p)
	{
		if (Paused != p)
		{
			Paused = p;
			int windowLong = N.GetWindowLong(base.Handle, -20);
			windowLong = (p ? (windowLong | 0x20) : (windowLong & -33));
			N.SetWindowLong(base.Handle, -20, windowLong);
			RegisterKeys(!p);
			dirty = full;
			Flush();
			Toolbar obj = toolbar;
			if (obj != null)
			{
				((Control)obj).Invalidate();
			}
		}
	}

	public void Undo()
	{
		if (strokes.Count != 0)
		{
			strokes.RemoveAt(strokes.Count - 1);
			Rebuild();
		}
	}

	public void ClearAll()
	{
		strokes.Clear();
		Rebuild();
	}

	private void Rebuild()
	{
		Graphics val = Graphics.FromImage((Image)(object)committed);
		try
		{
			val.Clear(Color.Transparent);
			foreach (Stroke stroke in strokes)
			{
				stroke.Draw(val);
			}
		}
		finally
		{
			((IDisposable)val)?.Dispose();
		}
		dirty = full;
		Flush();
	}

	protected override void OnMouseDown(MouseEventArgs e)
	{
		if (!Paused && (int)e.Button == 1048576)
		{
			if (Tool == Tool.Text)
			{
				OpenText(e.Location);
				return;
			}
			current = new Stroke
			{
				Tool = Tool,
				Color = Palette[ColorIndex],
				Width = ((Tool == Tool.Marker) ? (PenWidth * 3.5f) : PenWidth),
				A = e.Location,
				B = e.Location
			};
			current.Pts.Add(e.Location);
			lastCurBounds = Rectangle.Empty;
			MarkCurrent();
		}
	}

	protected override void OnMouseMove(MouseEventArgs e)
	{
		if (current == null)
		{
			return;
		}
		if (current.Tool == Tool.Pen || current.Tool == Tool.Marker)
		{
			List<Point> pts = current.Pts;
			Point point = pts[pts.Count - 1];
			if (Math.Abs(point.X - e.X) + Math.Abs(point.Y - e.Y) < 2)
			{
				return;
			}
			current.Pts.Add(e.Location);
		}
		else
		{
			current.B = e.Location;
		}
		MarkCurrent();
	}

	protected override void OnMouseUp(MouseEventArgs e)
	{
		if (current != null && (int)e.Button == 1048576)
		{
			Stroke s = current;
			current = null;
			Commit(s);
		}
	}

	private void Commit(Stroke s)
	{
		strokes.Add(s);
		Graphics val = Graphics.FromImage((Image)(object)committed);
		try
		{
			s.Draw(val);
		}
		finally
		{
			((IDisposable)val)?.Dispose();
		}
		dirty = U(dirty, U(s.Bounds(), lastCurBounds));
		lastCurBounds = Rectangle.Empty;
	}

	private void MarkCurrent()
	{
		Rectangle a = current.Bounds();
		dirty = U(dirty, U(a, lastCurBounds));
		lastCurBounds = a;
	}

	private static Rectangle U(Rectangle a, Rectangle b)
	{
		if (!a.IsEmpty)
		{
			if (!b.IsEmpty)
			{
				return Rectangle.Union(a, b);
			}
			return a;
		}
		return b;
	}

	private void OpenText(Point clientPt)
	{
		TextEntry obj = textEntry;
		if (obj != null)
		{
			((Form)obj).Close();
		}
		RegisterKeys(on: false);
		Point screenPt = new Point(vs.X + clientPt.X, vs.Y + clientPt.Y);
		Color color = Palette[ColorIndex];
		float px = TextPx;
		TextEntry obj2 = new TextEntry(screenPt, color, px);
		((Form)obj2).Owner = (Form)(object)this;
		textEntry = obj2;
		textEntry.Done += delegate(string text)
		{
			textEntry = null;
			RegisterKeys(!Paused);
			if (!string.IsNullOrWhiteSpace(text))
			{
				Commit(new Stroke
				{
					Tool = Tool.Text,
					Color = color,
					TextPx = px,
					Text = text,
					A = clientPt
				});
			}
		};
		((Control)textEntry).Show();
		((Control)textEntry).Focus();
	}

	private void Flush()
	{
		if (dirty.IsEmpty || surface == null)
		{
			return;
		}
		Rectangle rectangle = Rectangle.Intersect(dirty, full);
		dirty = Rectangle.Empty;
		if (!rectangle.IsEmpty)
		{
			Graphics val = Graphics.FromImage((Image)(object)surface);
			try
			{
				val.SetClip(rectangle);
				val.Clear(Paused ? Color.Transparent : Color.FromArgb(1, 0, 0, 0));
				val.CompositingMode = (CompositingMode)0;
				val.InterpolationMode = (InterpolationMode)5;
				val.DrawImage((Image)(object)committed, rectangle, rectangle, (GraphicsUnit)2);
				current?.Draw(val);
				val.Flush((FlushIntention)1);
			}
			finally
			{
				((IDisposable)val)?.Dispose();
			}
			Push(rectangle);
		}
	}

	private unsafe void Push(Rectangle r)
	{
		N.POINT pOINT = default(N.POINT);
		pOINT.X = vs.X;
		pOINT.Y = vs.Y;
		N.POINT pptDst = pOINT;
		N.SIZE sIZE = default(N.SIZE);
		sIZE.cx = vs.Width;
		sIZE.cy = vs.Height;
		N.SIZE psize = sIZE;
		pOINT = default(N.POINT);
		pOINT.X = 0;
		pOINT.Y = 0;
		N.POINT pptSrc = pOINT;
		N.BLENDFUNCTION bLENDFUNCTION = default(N.BLENDFUNCTION);
		bLENDFUNCTION.BlendOp = 0;
		bLENDFUNCTION.BlendFlags = 0;
		bLENDFUNCTION.SourceConstantAlpha = byte.MaxValue;
		bLENDFUNCTION.AlphaFormat = 1;
		N.BLENDFUNCTION pblend = bLENDFUNCTION;
		N.RECT rECT = default(N.RECT);
		rECT.Left = r.Left;
		rECT.Top = r.Top;
		rECT.Right = r.Right;
		rECT.Bottom = r.Bottom;
		N.RECT rECT2 = rECT;
		N.UPDATELAYEREDWINDOWINFO uPDATELAYEREDWINDOWINFO = default(N.UPDATELAYEREDWINDOWINFO);
		uPDATELAYEREDWINDOWINFO.cbSize = (uint)sizeof(N.UPDATELAYEREDWINDOWINFO);
		uPDATELAYEREDWINDOWINFO.hdcDst = screenDC;
		uPDATELAYEREDWINDOWINFO.pptDst = &pptDst;
		uPDATELAYEREDWINDOWINFO.psize = &psize;
		uPDATELAYEREDWINDOWINFO.hdcSrc = memDC;
		uPDATELAYEREDWINDOWINFO.pptSrc = &pptSrc;
		uPDATELAYEREDWINDOWINFO.crKey = 0u;
		uPDATELAYEREDWINDOWINFO.pblend = &pblend;
		uPDATELAYEREDWINDOWINFO.dwFlags = 2u;
		uPDATELAYEREDWINDOWINFO.prcDirty = &rECT2;
		N.UPDATELAYEREDWINDOWINFO info = uPDATELAYEREDWINDOWINFO;
		if (!N.UpdateLayeredWindowIndirect(base.Handle, ref info))
		{
			N.UpdateLayeredWindow(base.Handle, screenDC, ref pptDst, ref psize, memDC, ref pptSrc, 0u, ref pblend, 2u);
		}
	}

	private void KeepOnTop()
	{
		N.SetWindowPos(base.Handle, N.HWND_TOPMOST, 0, 0, 0, 0, 19u);
		if (toolbar != null && !((Control)toolbar).IsDisposed)
		{
			N.SetWindowPos(((Control)toolbar).Handle, N.HWND_TOPMOST, 0, 0, 0, 0, 19u);
		}
	}

	public void CloseFromToolbar()
	{
		ctx.EndSession();
	}

	protected override void OnFormClosed(FormClosedEventArgs e)
	{
		frame.Stop();
		keepTop.Stop();
		RegisterKeys(on: false);
		TextEntry obj = textEntry;
		if (obj != null)
		{
			((Form)obj).Close();
		}
		base.OnFormClosed(e);
	}

	protected override void Dispose(bool disposing)
	{
		if (disposing)
		{
			((Component)(object)frame).Dispose();
			((Component)(object)keepTop).Dispose();
			Bitmap obj = surface;
			if (obj != null)
			{
				((Image)obj).Dispose();
			}
			Bitmap obj2 = committed;
			if (obj2 != null)
			{
				((Image)obj2).Dispose();
			}
			if (paw != (Cursor)null && paw != Cursors.Cross)
			{
				paw.Dispose();
			}
		}
		if (memDC != IntPtr.Zero)
		{
			N.SelectObject(memDC, oldBmp);
			N.DeleteObject(hBmp);
			N.DeleteDC(memDC);
			memDC = IntPtr.Zero;
		}
		if (screenDC != IntPtr.Zero)
		{
			N.ReleaseDC(IntPtr.Zero, screenDC);
			screenDC = IntPtr.Zero;
		}
		base.Dispose(disposing);
	}
}
