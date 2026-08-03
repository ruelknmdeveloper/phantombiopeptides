import Link from "next/link";
import { cookies } from "next/headers";
import { CheckCircle2, Package, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildMetadata } from "@/lib/seo";
import { getSession } from "@/lib/wp-auth";
import { CartRefresh } from "./cart-refresh";
import { SaveForNextTime } from "./save-for-next-time";

export const metadata = buildMetadata({
  title: "Order confirmed",
  description: "Thanks for your order.",
  path: "/thank-you",
  noIndex: true,
});

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ order?: string; key?: string }>;
}

interface CheckoutIntent {
  order_id?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
}

async function readIntent(orderParam: string | undefined): Promise<CheckoutIntent | null> {
  // Only render the activation prompt when the request has a fresh
  // pl_checkout_intent cookie from finalizeCheckoutAction AND the cookie's
  // order id matches the URL param — prevents anyone loading a stranger's
  // /thank-you URL from being offered account creation for that order.
  const raw = (await cookies()).get("pl_checkout_intent")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CheckoutIntent;
    if (
      orderParam &&
      parsed.order_id !== undefined &&
      String(parsed.order_id) !== String(orderParam)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export default async function ThankYouPage({ searchParams }: Props) {
  const { order } = await searchParams;
  const session = await getSession();
  const intent = session ? null : await readIntent(order);

  return (
    <div className="container-page py-16 md:py-24">
      <CartRefresh />
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-7 w-7" strokeWidth={2.4} />
        </div>
        <p className="mt-6 text-[11px] uppercase tracking-[0.22em] text-primary">
          Order confirmed
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Thanks — your payment was received.
        </h1>
        <p className="mt-4 text-muted-foreground text-pretty leading-relaxed">
          {order
            ? `We've captured order #${order}. A confirmation email is on its way with tracking details.`
            : "We've captured your order. A confirmation email is on its way with tracking details."}
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 text-left">
            <Mail className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm font-medium">Confirmation email</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Arrives within a few minutes. Check spam if you don&apos;t see it.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 text-left">
            <Package className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm font-medium">Shipping</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Orders placed before 2pm ET dispatch same day, tracked via
              overnight carriers.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/shop">Continue shopping</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/contact">Contact support</Link>
          </Button>
        </div>

        {intent && intent.email && (
          <SaveForNextTime
            email={intent.email}
            firstName={intent.first_name ?? ""}
          />
        )}
      </div>
    </div>
  );
}
