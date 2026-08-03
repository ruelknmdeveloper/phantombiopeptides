import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/wp-auth";
import { AccountService } from "@/services/account";

export const metadata: Metadata = {
  title: "Overview",
  robots: { index: false, follow: false },
};

export default async function AccountOverviewPage() {
  // Edge proxy has already gated unauthed traffic. If we're rendering,
  // a session cookie is present — but its JWT may still be bad, in
  // which case the layout will clear + redirect.
  const session = await getSession();
  if (!session) return null;

  const orders = await AccountService.listOrders(session.userId).catch(() => []);
  const inFlight = orders.find((o) =>
    ["processing", "on-hold", "pending"].includes(o.status),
  );
  const recent = orders.slice(0, 5);

  return (
    <div className="space-y-10">
      {inFlight && (
        <section className="rounded-lg border p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
            In flight
          </p>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">Order #{inFlight.number}</h2>
              <p className="text-sm text-neutral-500 capitalize">
                {formatStatus(inFlight.status)}
              </p>
            </div>
            <Link
              href={`/account/orders/${inFlight.id}`}
              className="text-sm text-neutral-900 underline underline-offset-2"
            >
              Track shipment →
            </Link>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm uppercase tracking-[0.25em] text-neutral-500">
            Recent orders
          </h2>
          <Link
            href="/account/orders"
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No orders yet. When you place one it will appear here.
          </p>
        ) : (
          <ul className="divide-y">
            {recent.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">#{o.number}</p>
                  <p className="text-xs text-neutral-500">
                    {formatDate(o.date_created)} · {o.line_items_count} item
                    {o.line_items_count === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-neutral-700">
                    {o.currency} {o.total}
                  </span>
                  <span className="rounded-full border px-2 py-0.5 text-xs capitalize text-neutral-600">
                    {formatStatus(o.status)}
                  </span>
                  <Link
                    href={`/account/orders/${o.id}`}
                    className="text-sm text-neutral-900 hover:underline"
                  >
                    View →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-dashed p-5 text-sm text-neutral-500">
        <p>
          Wishlist, saved addresses, notifications, and support are on the left.
          Loyalty rewards are coming later this year.
        </p>
      </section>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatStatus(s: string): string {
  return s.replace(/[-_]/g, " ");
}
