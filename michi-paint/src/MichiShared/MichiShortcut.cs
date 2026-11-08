using System.Runtime.CompilerServices;
using System.Text;
using System.Windows.Forms;

namespace MichiShared;

internal sealed record MichiShortcut(int Id, Keys Key, string Action)
{
	[CompilerGenerated]
	private bool PrintMembers(StringBuilder builder)
	{
		RuntimeHelpers.EnsureSufficientExecutionStack();
		builder.Append("Id = ");
		builder.Append(Id.ToString());
		builder.Append(", Key = ");
		Keys key = Key;
		builder.Append(((object)key).ToString());
		builder.Append(", Action = ");
		builder.Append((object?)Action);
		return true;
	}

	[CompilerGenerated]
	public void Deconstruct(out int Id, out Keys Key, out string Action)
	{
		Id = this.Id;
		Key = (Keys)(int)this.Key;
		Action = this.Action;
	}
}
