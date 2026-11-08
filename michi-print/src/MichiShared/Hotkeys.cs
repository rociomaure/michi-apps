using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace MichiShared;

internal sealed class Hotkeys : NativeWindow, IDisposable
{
	private const int WM_HOTKEY = 786;

	public const uint MOD_ALT = 1u;

	public const uint MOD_CONTROL = 2u;

	public const uint MOD_SHIFT = 4u;

	public const uint MOD_NOREPEAT = 16384u;

	private readonly HashSet<int> ids = new HashSet<int>();

	public event Action<int> Pressed;

	public Hotkeys()
	{
		base.CreateHandle(new CreateParams());
	}

	public bool Add(int id, uint mods, Keys key)
	{
		bool num = RegisterHotKey(base.Handle, id, mods | 0x4000u, (uint)(int)key);
		if (num)
		{
			ids.Add(id);
		}
		return num;
	}

	public void RemoveAll()
	{
		foreach (int id in ids)
		{
			UnregisterHotKey(base.Handle, id);
		}
		ids.Clear();
	}

	protected override void WndProc(ref Message m)
	{
		if ((m).Msg == 786)
		{
			this.Pressed?.Invoke((int)(nint)(m).WParam);
		}
		else
		{
			base.WndProc(ref m);
		}
	}

	public void Dispose()
	{
		RemoveAll();
		base.DestroyHandle();
	}

	[DllImport("user32.dll")]
	private static extern bool RegisterHotKey(nint hWnd, int id, uint fsModifiers, uint vk);

	[DllImport("user32.dll")]
	private static extern bool UnregisterHotKey(nint hWnd, int id);
}
