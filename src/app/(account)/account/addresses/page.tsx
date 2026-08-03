import type { Metadata } from "next";
import { getSession } from "@/lib/wp-auth";
import { AccountService } from "@/services/account";
import { AddressesForm } from "./addresses-form";

export const metadata: Metadata = {
  title: "Addresses",
  robots: { index: false, follow: false },
};

export default async function AddressesPage() {
  const session = await getSession();
  if (!session) return null;

  const profile = await AccountService.getProfile(session.token).catch(
    () => null,
  );
  if (!profile) return null;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-medium">Addresses</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your default billing and shipping — used to pre-fill checkout.
        </p>
      </header>
      <AddressesForm
        billing={profile.billing ?? {}}
        shipping={profile.shipping ?? {}}
      />
    </div>
  );
}
