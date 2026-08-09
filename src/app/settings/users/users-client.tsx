"use client";

import { useActionState } from "react";
import type { MembershipRole } from "@prisma/client";
import { ASSIGNABLE_ROLES, MEMBERSHIP_ROLE_LABELS } from "@/lib/auth/constants";
import {
  createUserAction,
  resetUserPasswordAction,
  type UsersActionResult,
} from "../users-actions";

const initialState: UsersActionResult | null = null;

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);

  return (
    <form action={formAction} className="mt-4 space-y-3 border-t border-zinc-800 pt-4">
      <h3 className="text-sm font-medium text-zinc-200">Add staff account</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="displayName"
          placeholder="Display name"
          required
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          name="password"
          type="password"
          placeholder="Temporary password"
          required
          minLength={8}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <select
          name="role"
          defaultValue="STAFF"
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        >
          {ASSIGNABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {MEMBERSHIP_ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>
      {state && (
        <p className={`text-sm ${state.ok ? "text-emerald-400" : "text-red-400"}`}>{state.message}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create user"}
      </button>
    </form>
  );
}

function ResetPasswordForm({ userId, email }: { userId: string; email: string }) {
  const [state, formAction, pending] = useActionState(resetUserPasswordAction, initialState);

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input
        name="password"
        type="password"
        placeholder={`New password for ${email}`}
        required
        minLength={8}
        className="min-w-[12rem] flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
      >
        Reset
      </button>
      {state && !state.ok && <span className="text-xs text-red-400">{state.message}</span>}
      {state?.ok && <span className="text-xs text-emerald-400">{state.message}</span>}
    </form>
  );
}

export function UsersTable({
  users,
  currentUserId,
  toggleUserEnabledFormAction,
  updateUserRoleFormAction,
}: {
  users: {
    id: string;
    email: string;
    displayName: string;
    role: MembershipRole;
    enabled: boolean;
  }[];
  currentUserId: string;
  toggleUserEnabledFormAction: (formData: FormData) => Promise<void>;
  updateUserRoleFormAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="mt-4 space-y-3">
      {users.map((user) => (
        <div key={user.id} className="rounded-lg border border-zinc-800 px-3 py-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium text-zinc-100">
                {user.displayName}
                {!user.enabled && (
                  <span className="ml-2 text-xs text-red-400">Disabled</span>
                )}
              </p>
              <p className="text-zinc-400">{user.email}</p>
              <p className="text-xs text-zinc-500">{MEMBERSHIP_ROLE_LABELS[user.role]}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {user.id === currentUserId && (
                <span className="text-xs text-zinc-500">You</span>
              )}
              {user.role !== "OWNER" && (
                <>
                  <form action={toggleUserEnabledFormAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="enabled" value={user.enabled ? "false" : "true"} />
                    <button
                      type="submit"
                      className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                      {user.enabled ? "Disable" : "Enable"}
                    </button>
                  </form>
                  <form action={updateUserRoleFormAction} className="flex items-center gap-1">
                    <input type="hidden" name="userId" value={user.id} />
                    <select
                      name="role"
                      defaultValue={user.role}
                      className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
                    >
                      {ASSIGNABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {MEMBERSHIP_ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                      Set role
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
          {user.role !== "OWNER" && user.enabled && (
            <ResetPasswordForm userId={user.id} email={user.email} />
          )}
        </div>
      ))}
    </div>
  );
}
