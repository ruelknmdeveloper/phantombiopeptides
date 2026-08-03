import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { CheckCircle2, Package, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildMetadata } from "@/lib/seo";
import { getSession } from "@/lib/wp-auth";
import { AccountService } from "@/services/account";
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

async function readIntent(
  orderParam: string | undefined,
): Promise<CheckoutIntent | null> {
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

/**
 * The thank-you page is a *confirmation* screen — it should only
 * render for a visitor who actually just completed a checkout on this
 * device. Anyone else (bookmarked URL, forwarded link, curious poke)
 * is either sent to /account/orders (signed in — they can find their
 * real orders there) or /track-order (guest — public lookup by order#
 * + email).
 *
 * Three valid access paths:
 *   1. Fresh pl_checkout_intent cookie set by finalizeCheckoutAction
 *      (guest or signed-in, just completed checkout)
 *   2. Signed-in customer AND the ?order= param is one of their orders
 *      (they may have refreshed the URL after the cookie expired)
 *   3. No ?order= param but signed-in with an intent cookie
 */
async function isEntitledToViewOrderConfirmation(
  orderParam: string | undefined,
  intent: CheckoutIntent | null,
  sessionUserId: number | undefined,
): Promise<boolean> {
  if (intent) return true;

  // Signed-in customer refreshing the URL after cookie expiry — allow
  // if the order actually belongs to them.
  if (sessionUserId && orderParam) {
    const orderId = parseInt(orderParam, 10);
    if (!Number.isFinite(orderId)) return false;
    const order = await AccountService.getOrder(sessionUserId, orderId).catch(
      () => null,
    );
    return !!order;
  }

  return false;
}

export default async function ThankYouPage({ searchParams }: Props) {
  const { order } = await searchParams;
  const session = await getSession();
  const intent = await readIntent(order);

  const entitled = await isEntitledToViewOrderConfirmation(
    order,
    intent,
    session?.userId,
  );

  if (!entitled) {
    // Send them where they actually meant to go.
    redirect(session ? "/account/orders" : "/track-order");
  }

  // Activation prompt is only for guests who just completed checkout —
  // never for signed-in visitors (they already have an account).
  const showActivation = !session && intent && !!intent.email;

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
            <Link href={session ? "/account/orders" : "/shop"}>
              {session ? "See your orders" : "Continue shopping"}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/contact">Contact support</Link>
          </Button>
        </div>

        {showActivation && intent?.email && (
          <SaveForNextTime
            email={intent.email}
            firstName={intent.first_name ?? ""}
          />
        )}
      </div>
    </div>
  );
}
