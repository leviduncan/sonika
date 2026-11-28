import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { logout } from "@/app/(auth)/actions";
import AuthShell from "@/components/auth/AuthShell";
import SignOutButton from "@/components/auth/SignOutButton";
import { getAccount } from "@/lib/dal";

export const metadata: Metadata = { title: "Account unavailable · Sonika" };

/**
 * Where `requireProfile()` sends a signed-in user who has no profile. It sits
 * outside the proxy's auth and protected routes, so nothing bounces them away,
 * and it shows no account details.
 */
export default async function AccountUnavailablePage() {
  const { user, profile } = await getAccount();
  if (!user) redirect("/login");
  if (profile) redirect("/dashboard");

  return (
    <AuthShell
      title="Account unavailable"
      subtitle="We couldn't open a workspace for this account. Sign out to continue."
      footer={null}
    >
      <form action={logout}>
        <SignOutButton />
      </form>
    </AuthShell>
  );
}
