import type { Metadata } from "next";
import { getSession } from "@/lib/wp-auth";
import { AccountService } from "@/services/account";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) return null;

  const profile = await AccountService.getProfile(session.token).catch(
    () => null,
  );
  if (!profile) return null;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-medium">Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your name, contact info, and marketing preferences.
        </p>
      </header>
      <ProfileForm
        initial={{
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          phone: profile.phone ?? "",
          birthday: profile.birthday ?? "",
          marketing_consent: profile.marketing_consent,
        }}
      />
    </div>
  );
}
