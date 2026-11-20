import { Button } from "@/components/ui/button";
import { inviteStaff } from "./actions";

export function InviteStaffForm() {
  return (
    <form action={inviteStaff} className="space-y-3">
      <label className="block text-sm">
        <span className="text-textMuted">Email</span>
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">Display name</span>
        <input
          name="displayName"
          required
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">Role</span>
        <select
          name="role"
          defaultValue="writer"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        >
          <option value="admin">admin</option>
          <option value="editor">editor</option>
          <option value="writer">writer</option>
          <option value="sound">sound</option>
          <option value="moderator">moderator</option>
          <option value="viewer">viewer</option>
        </select>
      </label>
      <Button type="submit">Send invite</Button>
    </form>
  );
}
