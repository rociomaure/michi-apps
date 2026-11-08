using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace MichiPrint;

internal static class Native
{
	public struct MOUSEINPUT
	{
		public int dx;

		public int dy;

		public uint mouseData;

		public uint dwFlags;

		public uint time;

		public nint dwExtraInfo;
	}

	public struct KEYBDINPUT
	{
		public ushort wVk;

		public ushort wScan;

		public uint dwFlags;

		public uint time;

		public nint dwExtraInfo;
	}

	[StructLayout(LayoutKind.Explicit)]
	public struct InputUnion
	{
		[FieldOffset(0)]
		public MOUSEINPUT mi;

		[FieldOffset(0)]
		public KEYBDINPUT ki;
	}

	public struct INPUT
	{
		public uint type;

		public InputUnion U;
	}

	private const uint INPUT_KEYBOARD = 1u;

	private const uint KEYEVENTF_EXTENDEDKEY = 1u;

	private const uint KEYEVENTF_KEYUP = 2u;

	public static INPUT Key(ushort vk, ushort scan, bool up, bool extended)
	{
		uint dwFlags = (up ? 2u : 0u) | (extended ? 1u : 0u);
		INPUT result = default(INPUT);
		result.type = 1u;
		result.U = new InputUnion
		{
			ki = new KEYBDINPUT
			{
				wVk = vk,
				wScan = scan,
				dwFlags = dwFlags
			}
		};
		return result;
	}

	public static void SendKeys(INPUT[] inputs)
	{
		SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<INPUT>());
	}

	public static void SendCtrlV()
	{
		SendKeys(new INPUT[4]
		{
			Key(17, 0, up: false, extended: false),
			Key(86, 0, up: false, extended: false),
			Key(86, 0, up: true, extended: false),
			Key(17, 0, up: true, extended: false)
		});
	}

	public static bool IsDown(Keys k)
	{
		return (GetAsyncKeyState((int)k) & 0x8000) != 0;
	}

	[DllImport("user32.dll", SetLastError = true)]
	private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

	[DllImport("user32.dll")]
	private static extern short GetAsyncKeyState(int vKey);
}
