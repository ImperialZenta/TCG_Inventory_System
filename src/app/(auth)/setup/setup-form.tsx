"use client";

import { useActionState } from "react";
import { setupOwnerAction, type AuthActionResult } from "@/app/auth-actions";

const initialState: AuthActionResult | null = null;

export function SetupForm() {
  const [state, formAction, pending] = useActionState(setupOwnerAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="shopName" className="block text-sm font-medium text-zinc-300">
          Shop name
        </label>
        <input
          id="shopName"
          name="shopName"
          type="text"
          defaultValue="Shop"
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        />
      </div>
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-zinc-300">
          Your name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
          Owner email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        />
        <p className="mt-1 text-xs text-zinc-500">At least 8 characters</p>
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-300">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        />
      </div>
      {state && !state.ok && (
        <p className="text-sm text-red-400" role="alert">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
      >
        {pending ? "Creating account…" : "Create owner account"}
      </button>
    </form>
  );
}
