"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { CartService } from "@/services/cart";
import { CheckoutService } from "@/services/checkout";
import { requireStripe } from "@/lib/stripe-server";
import type { WCAddress } from "@/types";

const CHECKOUT_INTENT_COOKIE = "pl_checkout_intent";
const CHECKOUT_INTENT_MAX_AGE = 15 * 60; // 15 minutes — long enough for the
// customer to notice the "save this for next time?" prompt on /thank-you and
// decide, short enough that a stale intent can't attach to someone else's session.

export interface StartCheckoutInput {
  billing_address: WCAddress;
  shipping_address: WCAddress;
  customer_note?: string;
}

export interface StartCheckoutResult {
  ok: boolean;
  error?: string;
  client_secret?: string;
  payment_intent_id?: string;
  amount?: number;
}

/**
 * Payment goes first, order goes second.
 *
 * WordPress.com's REST orders endpoint occasionally returns a wpcomsh
 * fatal PHP error 500 even when the same payload succeeds via curl
 * moments later. We refuse to let that block the customer. So the
 * flow is:
 *   1. Create a Stripe PaymentIntent for the exact cart total with
 *      the cart line items serialized into the PI's metadata (so the
 *      cart contents survive even if the Woo order write drops).
 *   2. Customer confirms the payment against Stripe.
 *   3. `finalizeCheckoutAction` (below) verifies the PI is
 *      succeeded, THEN writes the Woo order with status=processing
 *      set_paid=true. If Woo write fails, we still let the customer
 *      through and mark the PI so it can be reconciled server-side
 *      later.
 */
export async function startCheckoutAction(
  input: StartCheckoutInput,
): Promise<StartCheckoutResult> {
  try {
    const stripe = requireStripe();

    // Read the live cart so amount always matches what the customer
    // sees, not something the client claims.
    const cart = await CartService.get();
    if (cart.items.length === 0) {
      return { ok: false, error: "Your cart is empty." };
    }

    const total = parseFloat(cart.totals.total_price) || 0;
    if (total <= 0) {
      return { ok: false, error: "Cart total is zero." };
    }

    const minorUnits = cart.totals.currency_minor_unit ?? 2;
    const amountMinor = Math.round(total * 10 ** minorUnits);
    const currency = (cart.totals.currency_code || "USD").toLowerCase();

    // Serialize the cart lines into PI metadata so a downstream write
    // failure still leaves us a reconstructable order.
    const rawItems = await CartService.getLineItems();
    const itemsMeta = JSON.stringify(
      rawItems.slice(0, 20).map((it) => ({
        id: it.id,
        q: it.quantity,
        v: it.variation ?? null,
      })),
    );

    const pi = await stripe.paymentIntents.create({
      amount: amountMinor,
      currency,
      // Must match the client-side Elements config (checkout-form.tsx
      // pins paymentMethodTypes: ["card"]). If this stays on
      // automatic_payment_methods, Stripe refuses to confirm the PI
      // with the error "Payment details were collected through Stripe
      // Elements using payment_method_types and cannot be confirmed
      // through the API configured with automatic payment methods".
      payment_method_types: ["card"],
      metadata: {
        source: "phantombiopeptides-nextjs",
        cart_items: itemsMeta.slice(0, 480),
        billing_email: input.billing_address.email,
        billing_name:
          `${input.billing_address.first_name} ${input.billing_address.last_name}`.trim(),
        billing_country: input.billing_address.country,
        shipping_country: input.shipping_address.country,
        customer_note: (input.customer_note ?? "").slice(0, 400),
      },
      description: `Phantom Bio Peptides — ${cart.items_count} item${cart.items_count === 1 ? "" : "s"}`,
    });

    return {
      ok: true,
      client_secret: pi.client_secret ?? undefined,
      payment_intent_id: pi.id,
      amount: amountMinor,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Checkout could not be started.";
    console.error("[startCheckoutAction]", message);
    return { ok: false, error: message };
  }
}

export interface FinalizeInput {
  payment_intent_id: string;
  billing_address: WCAddress;
  shipping_address: WCAddress;
  customer_note?: string;
}

export interface FinalizeResult {
  ok: boolean;
  order_id?: number;
  error?: string;
}

/**
 * Called by the browser after `stripe.confirmPayment` returns
 * succeeded. Independently verifies the PaymentIntent against Stripe,
 * then tries to create the Woo order. Any Woo failure is logged and
 * recorded on the PaymentIntent for later reconciliation — the
 * customer still completes checkout because the money is already
 * captured.
 */
export async function finalizeCheckoutAction(
  input: FinalizeInput,
): Promise<FinalizeResult> {
  const stripe = requireStripe();

  // 1. Confirm the payment really succeeded.
  let pi;
  try {
    pi = await stripe.paymentIntents.retrieve(input.payment_intent_id);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Payment could not be verified.",
    };
  }
  if (pi.status !== "succeeded") {
    return {
      ok: false,
      error: `Payment not completed (status: ${pi.status}).`,
    };
  }

  // 2. Try to create the Woo order. This can fail on WP.com hosting
  // hiccups; don't let that block the customer.
  try {
    const order = await CheckoutService.submit({
      billing_address: input.billing_address,
      shipping_address: input.shipping_address,
      customer_note: input.customer_note ?? "",
      payment_method: "stripe",
      payment_data: [
        { key: "stripe_payment_intent_id", value: input.payment_intent_id },
      ],
      // Mark the order as processing + paid up front — payment is
      // already captured on Stripe.
      status_override: "processing",
      set_paid: true,
      transaction_id: input.payment_intent_id,
    });

    await CartService.clear();
    revalidatePath("/cart");

    // Set a short-lived intent cookie so /thank-you can render the
    // "save this for next time?" activation prompt with prefilled name
    // and email. No account is created here — the customer opts in
    // explicitly on the thank-you page.
    try {
      const store = await cookies();
      store.set(CHECKOUT_INTENT_COOKIE, JSON.stringify({
        order_id: order.order_id,
        email: input.billing_address.email,
        first_name: input.billing_address.first_name,
        last_name: input.billing_address.last_name,
      }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: CHECKOUT_INTENT_MAX_AGE,
      });
    } catch {
      // Cookie failure shouldn't block the redirect to /thank-you.
    }

    return { ok: true, order_id: order.order_id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Order write failed.";
    console.error("[finalizeCheckoutAction] Woo order write failed", {
      payment_intent_id: input.payment_intent_id,
      message,
    });
    // Tag the PI so we can find these when reconciling later.
    try {
      await stripe.paymentIntents.update(input.payment_intent_id, {
        metadata: {
          ...(pi.metadata ?? {}),
          woo_order_write_failed: "true",
          woo_order_error: message.slice(0, 480),
        },
      });
    } catch {
      /* best-effort */
    }
    // Cart is still cleared — the money is already captured, we don't
    // want the customer to accidentally pay twice.
    await CartService.clear();
    revalidatePath("/cart");
    return { ok: true };
  }
}
