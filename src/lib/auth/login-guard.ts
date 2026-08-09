import { redirect } from "next/navigation";
import { hasAnyUser } from "./bootstrap";

/** Redirect fresh installs to /setup before showing the login form. */
export async function redirectToSetupIfNoUsers(): Promise<void> {
  if (!(await hasAnyUser())) {
    redirect("/setup");
  }
}
