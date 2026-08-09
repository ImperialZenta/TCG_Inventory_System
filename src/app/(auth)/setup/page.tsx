import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/auth";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasAnyUser()) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="text-2xl font-semibold text-zinc-100">First-time setup</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Create the owner account before anyone else can use this system.
      </p>
      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <SetupForm />
      </div>
    </div>
  );
}
