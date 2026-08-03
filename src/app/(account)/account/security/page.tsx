import type { Metadata } from "next";
import { getSession } from "@/lib/wp-auth";
import { AccountService } from "@/services/account";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = {
  title: "Security",
  robots: { index: false, follow: false },
};

export default async function SecurityPage() {
  const session = await getSession();
  if (!session) return null;

  const profile = await AccountService.getProfile(session.token).catch(
    () => null,
  );

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-xl font-medium">Security</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your password and account safety.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <h3 className="text-sm font-medium">Change password</h3>
        <ChangePasswordForm />
      </section>

      <section className="space-y-2 rounded-2xl border border-border bg-card p-6">
        <h3 className="text-sm font-medium">Email</h3>
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground">{profile?.email}</span>
          {profile?.email_verified_at ? (
            <span className="ml-2 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700">
              Verified
            </span>
          ) : (
            <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700">
              Not verified
            </span>
          )}
        </p>
      </section>

      <section className="rounded-2xl border border-dashed border-border p-5 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Coming soon</p>
        <p className="mt-1">
          Two-factor authentication, active session list, and one-click sign
          out from all devices.
        </p>
      </section>
    </div>
  );
}
