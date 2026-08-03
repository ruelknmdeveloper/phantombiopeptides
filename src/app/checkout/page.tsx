import Link from "next/link";
import { ShoppingBag, KeyRound } from "lucide-react";
import { CartService } from "@/services/cart";
import { Breadcrumb } from "@/components/common/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  CheckoutForm,
  type CheckoutPrefill,
} from "@/components/checkout/checkout-form";
import { buildMetadata } from "@/lib/seo";
import { env } from "@/env";
import { getSession } from "@/lib/wp-auth";
import { AccountService } from "@/services/account";

export const metadata = buildMetadata({
  title: "Checkout",
  description: "Complete your research order securely.",
  path: "/checkout",
  noIndex: true,
});

export const dynamic = "force-dynamic";

async function readPrefill(): Promise<CheckoutPrefill | undefined> {
  const session = await getSession();
  if (!session) return undefined;
  const profile = await AccountService.getProfile(session.token).catch(
    () => null,
  );
  if (!profile) return undefined;

  // Shipping fields on the form use "unprefixed" names (first_name,
  // address_1, etc.), billing fields use "billing_" prefix. Map both
  // from the customer's saved billing/shipping.
  const s = profile.shipping ?? {};
  const b = profile.billing ?? {};
  const sameAsBilling =
    !!s.address_1 &&
    !!b.address_1 &&
    s.address_1 === b.address_1 &&
    (s.postcode ?? "") === (b.postcode ?? "");

  return {
    email: profile.email,
    first_name: s.first_name ?? b.first_name ?? profile.first_name ?? "",
    last_name: s.last_name ?? b.last_name ?? profile.last_name ?? "",
    company: s.company ?? "",
    address_1: s.address_1 ?? "",
    address_2: s.address_2 ?? "",
    city: s.city ?? "",
    state: s.state ?? "",
    postcode: s.postcode ?? "",
    country: s.country ?? "",
    phone: b.phone ?? profile.phone ?? "",
    billing_same: sameAsBilling || !b.address_1,
    billing_first_name: b.first_name ?? "",
    billing_last_name: b.last_name ?? "",
    billing_company: b.company ?? "",
    billing_address_1: b.address_1 ?? "",
    billing_address_2: b.address_2 ?? "",
    billing_city: b.city ?? "",
    billing_state: b.state ?? "",
    billing_postcode: b.postcode ?? "",
    billing_country: b.country ?? "",
    billing_phone: b.phone ?? "",
  };
}

export default async function CheckoutPage() {
  const cart = await CartService.get().catch(() => null);
  const hasStripe = Boolean(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const prefill = await readPrefill();

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container-page py-16">
        <Breadcrumb
          crumbs={[
            { label: "Home", href: "/" },
            { label: "Cart", href: "/cart" },
            { label: "Checkout" },
          ]}
        />
        <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border p-16 text-center">
          <ShoppingBag className="h-8 w-8 text-muted-foreground" />
          <p className="text-lg font-medium">Nothing to check out yet</p>
          <Button asChild>
            <Link href="/shop">Continue browsing</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-10 md:py-14">
      <Breadcrumb
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Cart", href: "/cart" },
          { label: "Checkout" },
        ]}
      />
      <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
        Checkout
      </h1>

      {!hasStripe ? (
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/5 p-5 text-sm">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium text-foreground">
              Stripe publishable key missing
            </p>
            <p className="mt-1 text-muted-foreground">
              Set{" "}
              <code className="font-mono">
                NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
              </code>{" "}
              in Vercel (Project → Settings → Environment Variables) to
              enable the payment form. It starts with{" "}
              <code className="font-mono">pk_live_</code> or{" "}
              <code className="font-mono">pk_test_</code>. The matching{" "}
              <code className="font-mono">STRIPE_SECRET_KEY</code> is also
              required for the server side of the flow.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <CheckoutForm cart={cart} prefill={prefill} />
        </div>
      )}
    </div>
  );
}
