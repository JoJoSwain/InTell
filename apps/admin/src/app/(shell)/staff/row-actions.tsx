import {
  ServerActionForm,
  ServerActionSubmit,
} from "@/components/server-action-form";
import { Button } from "@/components/ui/button";
import {
  deactivateStaff,
  reactivateStaff,
  updateStaffRow,
} from "./actions";

export function StaffRowActions({
  userId,
  displayName,
  role,
  active,
  isSelf,
}: {
  userId: string;
  displayName: string;
  role: string;
  active: boolean;
  isSelf: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <ServerActionForm
        action={updateStaffRow}
        className="flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="userId" value={userId} />
        <label className="block text-xs">
          <span className="text-textMuted">Name</span>
          <input
            name="displayName"
            defaultValue={displayName}
            className="mt-1 block w-36 rounded-md border border-input bg-background px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-textMuted">Role</span>
          <select
            name="role"
            defaultValue={role}
            className="mt-1 block rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="admin">admin</option>
            <option value="editor">editor</option>
            <option value="writer">writer</option>
            <option value="sound">sound</option>
            <option value="moderator">moderator</option>
            <option value="viewer">viewer</option>
          </select>
        </label>
        <ServerActionSubmit variant="outline" size="sm">
          Save
        </ServerActionSubmit>
      </ServerActionForm>
      {!isSelf && active ? (
        <form action={deactivateStaff}>
          <input type="hidden" name="userId" value={userId} />
          <Button type="submit" variant="outline" size="sm">
            Deactivate
          </Button>
        </form>
      ) : null}
      {!isSelf && !active ? (
        <form action={reactivateStaff}>
          <input type="hidden" name="userId" value={userId} />
          <Button type="submit" variant="outline" size="sm">
            Reactivate
          </Button>
        </form>
      ) : null}
    </div>
  );
}
