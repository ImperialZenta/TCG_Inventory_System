"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction, type AuthActionResult } from "@/app/auth-actions";

const initialState: AuthActionResult | null = null;

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
          Email
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
          autoComplete="current-password"
          required
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
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-zinc-500">
        First install?{" "}
        <Link href="/setup" className="text-amber-400 hover:underline">
          Create owner account
        </Link>
      </p>
    </form>
  );
}
