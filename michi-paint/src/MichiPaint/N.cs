using System;
using System.Runtime.InteropServices;

namespace MichiPaint;

internal static class N
{
	public struct POINT
	{
		public int X;

		public int Y;
	}

	public struct SIZE
	{
		public int cx;

		public int cy;
	}

	public struct RECT
	{
		public int Left;

		public int Top;

		public int Right;

		public int Bottom;
	}

	[StructLayout(LayoutKind.Sequential, Pack = 1)]
	public struct BLENDFUNCTION
	{
		public byte BlendOp;

		public byte BlendFlags;

		public byte SourceConstantAlpha;

		public byte AlphaFormat;
	}

	public struct UPDATELAYEREDWINDOWINFO
	{
		public uint cbSize;

		public nint hdcDst;

		public unsafe POINT* pptDst;

		public unsafe SIZE* psize;

		public nint hdcSrc;

		public unsafe POINT* pptSrc;

		public uint crKey;

		public unsafe BLENDFUNCTION* pblend;

		public uint dwFlags;

		public unsafe RECT* prcDirty;
	}

	public struct BITMAPINFO
	{
		public int biSize;

		public int biWidth;

		public int biHeight;

		public short biPlanes;

		public short biBitCount;

		public int biCompression;

		public int biSizeImage;

		public int biXPelsPerMeter;

		public int biYPelsPerMeter;

		public int biClrUsed;

		public int biClrImportant;

		public int bmiColors;
	}

	public struct ICONINFO
	{
		public bool fIcon;

		public uint xHotspot;

		public uint yHotspot;

		public nint hbmMask;

		public nint hbmColor;
	}

	public const int WS_EX_LAYERED = 524288;

	public const int WS_EX_TRANSPARENT = 32;

	public const int WS_EX_TOOLWINDOW = 128;

	public const int WS_EX_TOPMOST = 8;

	public const int WS_EX_NOACTIVATE = 134217728;

	public const int GWL_EXSTYLE = -20;

	public const uint SWP_NOSIZE = 1u;

	public const uint SWP_NOMOVE = 2u;

	public const uint SWP_NOACTIVATE = 16u;

	public const uint SWP_SHOWWINDOW = 64u;

	public static readonly nint HWND_TOPMOST = new IntPtr(-1);

	public const uint MOD_CONTROL = 2u;

	public const uint MOD_NOREPEAT = 16384u;

	[DllImport("user32.dll")]
	public static extern bool UpdateLayeredWindowIndirect(nint hwnd, ref UPDATELAYEREDWINDOWINFO info);

	[DllImport("user32.dll")]
	public static extern bool UpdateLayeredWindow(nint hwnd, nint hdcDst, ref POINT pptDst, ref SIZE psize, nint hdcSrc, ref POINT pptSrc, uint crKey, ref BLENDFUNCTION pblend, uint dwFlags);

	[DllImport("user32.dll")]
	public static extern nint GetDC(nint hwnd);

	[DllImport("user32.dll")]
	public static extern int ReleaseDC(nint hwnd, nint hdc);

	[DllImport("gdi32.dll")]
	public static extern nint CreateCompatibleDC(nint hdc);

	[DllImport("gdi32.dll")]
	public static extern bool DeleteDC(nint hdc);

	[DllImport("gdi32.dll")]
	public static extern nint CreateDIBSection(nint hdc, ref BITMAPINFO bmi, uint usage, out nint bits, nint hSection, uint offset);

	[DllImport("gdi32.dll")]
	public static extern nint SelectObject(nint hdc, nint obj);

	[DllImport("gdi32.dll")]
	public static extern bool DeleteObject(nint obj);

	[DllImport("user32.dll")]
	public static extern int GetWindowLong(nint hwnd, int index);

	[DllImport("user32.dll")]
	public static extern int SetWindowLong(nint hwnd, int index, int value);

	[DllImport("user32.dll")]
	public static extern bool SetWindowPos(nint hwnd, nint after, int x, int y, int cx, int cy, uint flags);

	[DllImport("user32.dll")]
	public static extern bool RegisterHotKey(nint hwnd, int id, uint mods, uint vk);

	[DllImport("user32.dll")]
	public static extern bool UnregisterHotKey(nint hwnd, int id);

	[DllImport("user32.dll")]
	public static extern bool ReleaseCapture();

	[DllImport("user32.dll")]
	public static extern nint SendMessage(nint hwnd, int msg, nint wp, nint lp);

	[DllImport("user32.dll")]
	public static extern nint GetForegroundWindow();

	[DllImport("user32.dll")]
	public static extern bool SetForegroundWindow(nint hwnd);

	[DllImport("user32.dll")]
	public static extern bool GetIconInfo(nint hIcon, out ICONINFO info);

	[DllImport("user32.dll")]
	public static extern nint CreateIconIndirect(ref ICONINFO info);

	[DllImport("user32.dll")]
	public static extern bool DestroyIcon(nint hIcon);
}
