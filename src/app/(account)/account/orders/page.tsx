import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/wp-auth";
import { AccountService } from "@/services/account";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

export default async function OrdersPage() {
  // Edge proxy has already gated unauthed traffic. The layout will
  // clear + redirect if the JWT is tampered.
  const session = await getSession();
  if (!session) return null;
  const orders = await AccountService.listOrders(session.userId).catch(() => []);

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-neutral-500">
        You haven&apos;t placed any orders yet.
        <div className="mt-4">
          <Link
            href="/shop"
            className="text-sm text-neutral-900 underline underline-offset-2"
          >
            Shop the collection →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm uppercase tracking-[0.25em] text-neutral-500">
        Order history
      </h2>
      <ul className="divide-y rounded-lg border">
        {orders.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium">#{o.number}</p>
              <p className="text-xs text-neutral-500">
                {formatDate(o.date_created)} · {o.line_items_count} item
                {o.line_items_count === 1 ? "" : "s"} · {o.currency} {o.total}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border px-2 py-0.5 text-xs capitalize text-neutral-600">
                {o.status.replace(/[-_]/g, " ")}
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
