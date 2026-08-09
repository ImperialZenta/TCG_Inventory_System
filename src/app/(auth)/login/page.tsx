import { redirect } from "next/navigation";
import { redirectToSetupIfNoUsers } from "@/lib/auth/login-guard";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  await redirectToSetupIfNoUsers();

  const params = await searchParams;
  const callbackUrl =
    params.callbackUrl?.startsWith("/") && !params.callbackUrl.startsWith("//")
      ? params.callbackUrl
      : "/";

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="text-2xl font-semibold text-zinc-100">Sign in</h1>
      <p className="mt-2 text-sm text-zinc-400">Staff access to TCG Chaos Inventory</p>
      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </div>
  );
}
