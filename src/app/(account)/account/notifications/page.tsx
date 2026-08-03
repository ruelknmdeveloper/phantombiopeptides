import type { Metadata } from "next";
import { getSession } from "@/lib/wp-auth";
import { AccountService } from "@/services/account";
import { NotificationsForm } from "./notifications-form";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) return null;

  const prefs = await AccountService.getNotifications(session.token).catch(
    () => null,
  );

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-medium">Notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose what you want to hear about — and how.
        </p>
      </header>
      <NotificationsForm
        initial={
          prefs ?? {
            order_updates: true,
            back_in_stock: true,
            price_drops: false,
            new_arrivals: false,
            promotions: false,
            newsletter: false,
            channels: { email: true, sms: false, push: false },
          }
        }
      />
    </div>
  );
}
