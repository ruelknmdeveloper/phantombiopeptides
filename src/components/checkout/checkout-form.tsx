"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Lock, ArrowRight, AlertTriangle } from "lucide-react";
import { getStripe } from "@/lib/stripe";
import {
  startCheckoutAction,
  finalizeCheckoutAction,
} from "@/app/actions/checkout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CouponPanel } from "./coupon-panel";
import { useCart } from "@/hooks/use-cart";
import type { WCCart, WCAddress } from "@/types";
import { formatPrice } from "@/lib/utils";
import {
  trackInitiateCheckout,
  trackCompletePayment,
  ttqIdentify,
  type TrackableItem,
} from "@/lib/tiktok";

const schema = z
  .object({
    email: z.string().email("Enter a valid email"),
    first_name: z.string().min(1, "Required"),
    last_name: z.string().min(1, "Required"),
    company: z.string().optional(),
    address_1: z.string().min(1, "Required"),
    address_2: z.string().optional(),
    city: z.string().min(1, "Required"),
    state: z.string().min(1, "Required"),
    postcode: z.string().min(3, "Required"),
    country: z.string().min(2).max(2, "Use a 2-letter country code"),
    phone: z.string().optional(),
    customer_note: z.string().optional(),
    billing_same: z.boolean(),
    billing_first_name: z.string().optional(),
    billing_last_name: z.string().optional(),
    billing_company: z.string().optional(),
    billing_address_1: z.string().optional(),
    billing_address_2: z.string().optional(),
    billing_city: z.string().optional(),
    billing_state: z.string().optional(),
    billing_postcode: z.string().optional(),
    billing_country: z.string().optional(),
    billing_phone: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.billing_same) return;
    const required: Array<[keyof typeof val, string | undefined]> = [
      ["billing_first_name", val.billing_first_name],
      ["billing_last_name", val.billing_last_name],
      ["billing_address_1", val.billing_address_1],
      ["billing_city", val.billing_city],
      ["billing_state", val.billing_state],
    ];
    for (const [field, value] of required) {
      if (!value || value.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "Required",
        });
      }
    }
    if (!val.billing_postcode || val.billing_postcode.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["billing_postcode"],
        message: "Required",
      });
    }
    if (
      !val.billing_country ||
      val.billing_country.length !== 2
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["billing_country"],
        message: "Use a 2-letter country code",
      });
    }
  });

type Values = z.infer<typeof schema>;

export interface CheckoutPrefill {
  email?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  phone?: string;
  billing_first_name?: string;
  billing_last_name?: string;
  billing_company?: string;
  billing_address_1?: string;
  billing_address_2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postcode?: string;
  billing_country?: string;
  billing_phone?: string;
  billing_same?: boolean;
}

export function CheckoutForm({
  cart: initialCart,
  prefill,
}: {
  cart: WCCart;
  prefill?: CheckoutPrefill;
}) {
  const { cart: liveCart } = useCart();
  const cart = liveCart ?? initialCart;
  const stripePromise = React.useMemo(() => getStripe(), []);
  const currency = cart.totals.currency_code.toLowerCase();
  const amountMinor = Math.round(
    parseFloat(cart.totals.total_price) *
      10 ** (cart.totals.currency_minor_unit ?? 2),
  );

  // "Deferred" Elements mode — we haven't created a PaymentIntent yet
  // (that happens on submit), so we pass amount + currency here and
  // Stripe uses them to decide which methods to show (Card, Apple Pay,
  // Google Pay, Link, etc.).
  //
  // Stripe's Payment Element renders in a cross-origin iframe so CSS
  // custom properties like `var(--font-brand)` from the host page do
  // not resolve. Load Barlow (our brand font) directly via
  // `fonts.cssSrc` and name it explicitly.
  const options: StripeElementsOptions = {
    mode: "payment",
    amount: amountMinor > 0 ? amountMinor : 100,
    currency,
    // Card only. Apple Pay and Google Pay ride on the "card" method
    // via Stripe's wallets support, so restricting to ["card"] keeps
    // wallets available while dropping Link, Cash App Pay, US bank
    // debits, Klarna, Amazon Pay, etc.
    paymentMethodTypes: ["card"],
    fonts: [
      {
        cssSrc:
          "https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700&display=swap",
      },
    ],
    appearance: {
      theme: "stripe",
      variables: {
        colorPrimary: "hsl(264 100% 34%)",
        borderRadius: "12px",
        fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif",
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <InnerCheckoutForm cart={cart} prefill={prefill} />
    </Elements>
  );
}

function InnerCheckoutForm({
  cart,
  prefill,
}: {
  cart: WCCart;
  prefill?: CheckoutPrefill;
}) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: prefill?.email ?? "",
      first_name: prefill?.first_name ?? "",
      last_name: prefill?.last_name ?? "",
      company: prefill?.company ?? "",
      address_1: prefill?.address_1 ?? "",
      address_2: prefill?.address_2 ?? "",
      city: prefill?.city ?? "",
      state: prefill?.state ?? "",
      postcode: prefill?.postcode ?? "",
      country: prefill?.country || "US",
      phone: prefill?.phone ?? "",
      billing_same: prefill?.billing_same ?? true,
      billing_first_name: prefill?.billing_first_name ?? "",
      billing_last_name: prefill?.billing_last_name ?? "",
      billing_company: prefill?.billing_company ?? "",
      billing_address_1: prefill?.billing_address_1 ?? "",
      billing_address_2: prefill?.billing_address_2 ?? "",
      billing_city: prefill?.billing_city ?? "",
      billing_state: prefill?.billing_state ?? "",
      billing_postcode: prefill?.billing_postcode ?? "",
      billing_country: prefill?.billing_country || "US",
      billing_phone: prefill?.billing_phone ?? "",
    },
  });
  const billingSame = watch("billing_same");

  const currency = cart.totals.currency_code;

  const ttqItems = React.useCallback(
    (): TrackableItem[] =>
      cart.items.map((item) => ({
        id: (item as { id?: number | string }).id ?? item.key,
        name: item.name,
        quantity: item.quantity,
        price:
          item.quantity > 0
            ? parseFloat(item.totals.line_total) / item.quantity
            : undefined,
      })),
    [cart],
  );

  // Report checkout intent to TikTok once per checkout view.
  const initiateTracked = React.useRef(false);
  React.useEffect(() => {
    if (initiateTracked.current) return;
    initiateTracked.current = true;
    trackInitiateCheckout(ttqItems(), cart.totals.total_price, currency);
  }, [ttqItems, cart.totals.total_price, currency]);

  async function onSubmit(values: Values) {
    setError(null);

    if (!stripe || !elements) {
      setError("Payment provider is still loading. Try again in a moment.");
      return;
    }

    setSubmitting(true);
    try {
      // Have the Payment Element validate what the customer has typed.
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message ?? "Please check the payment details.");
        return;
      }

      const shippingAddress: WCAddress = {
        first_name: values.first_name,
        last_name: values.last_name,
        company: values.company ?? "",
        address_1: values.address_1,
        address_2: values.address_2 ?? "",
        city: values.city,
        state: values.state,
        postcode: values.postcode,
        country: values.country.toUpperCase(),
        email: values.email,
        phone: values.phone ?? "",
      };
      const billingAddress: WCAddress = values.billing_same
        ? shippingAddress
        : {
            first_name: values.billing_first_name ?? "",
            last_name: values.billing_last_name ?? "",
            company: values.billing_company ?? "",
            address_1: values.billing_address_1 ?? "",
            address_2: values.billing_address_2 ?? "",
            city: values.billing_city ?? "",
            state: values.billing_state ?? "",
            postcode: values.billing_postcode ?? "",
            country: (values.billing_country ?? "US").toUpperCase(),
            email: values.email,
            phone: values.billing_phone ?? values.phone ?? "",
          };

      // Improve TikTok match quality — the pixel hashes these values
      // in the browser before they are sent.
      ttqIdentify({
        email: values.email,
        phone_number: values.phone || undefined,
      });

      // 1. Ask the server for a Stripe PaymentIntent for the live cart.
      //    Woo order creation happens AFTER payment succeeds so a WP
      //    hiccup can't block the customer from paying.
      const start = await startCheckoutAction({
        billing_address: billingAddress,
        shipping_address: shippingAddress,
        customer_note: values.customer_note ?? "",
      });
      if (!start.ok || !start.client_secret || !start.payment_intent_id) {
        setError(start.error ?? "Checkout could not be started.");
        return;
      }

      // 2. Confirm the payment. redirect: "if_required" keeps the
      //    customer on this page unless a bank pushes 3DS. billing
      //    details use the actual billing address (needed for AVS
      //    card verification), which may differ from shipping.
      const { error: confirmError, paymentIntent } =
        await stripe.confirmPayment({
          elements,
          clientSecret: start.client_secret,
          confirmParams: {
            return_url: `${window.location.origin}/thank-you`,
            payment_method_data: {
              billing_details: {
                email: values.email,
                name: `${billingAddress.first_name} ${billingAddress.last_name}`.trim(),
                phone: billingAddress.phone || undefined,
                address: {
                  line1: billingAddress.address_1,
                  line2: billingAddress.address_2 || undefined,
                  city: billingAddress.city,
                  state: billingAddress.state,
                  postal_code: billingAddress.postcode,
                  country: billingAddress.country,
                },
              },
            },
          },
          redirect: "if_required",
        });

      if (confirmError) {
        setError(
          confirmError.message ??
            "Payment was declined. Please try a different card.",
        );
        return;
      }
      if (paymentIntent?.status !== "succeeded") {
        setError(
          `Payment was not completed (status: ${paymentIntent?.status ?? "unknown"}).`,
        );
        return;
      }

      // Payment captured — report the conversion to TikTok.
      trackCompletePayment(ttqItems(), cart.totals.total_price, currency);

      // 3. Payment is captured. Ask the server to record the Woo order
      //    + clear the cart. Woo failure here does not block the
      //    customer — the finalize action logs the failure to Stripe
      //    metadata for reconciliation and still returns ok.
      const finalize = await finalizeCheckoutAction({
        payment_intent_id: paymentIntent.id,
        billing_address: billingAddress,
        shipping_address: shippingAddress,
        customer_note: values.customer_note ?? "",
      });
      if (!finalize.ok) {
        toast.error(
          "Payment approved but our order system had a hiccup — support will follow up.",
        );
      } else if (!finalize.order_id) {
        toast.success(
          "Payment approved — your order will be confirmed shortly.",
        );
      } else {
        toast.success("Payment approved — thank you.");
      }

      const q = new URLSearchParams();
      q.set("pi", paymentIntent.id);
      if (finalize.order_id) q.set("order", String(finalize.order_id));
      router.push(`/thank-you?${q.toString()}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-8 lg:grid-cols-[1fr_360px]"
    >
      <div className="space-y-6">
        <fieldset className="rounded-2xl border border-border bg-card p-6">
          <legend className="px-2 text-xs uppercase tracking-widest text-muted-foreground">
            Contact
          </legend>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-2xl border border-border bg-card p-6">
          <legend className="px-2 text-xs uppercase tracking-widest text-muted-foreground">
            Shipping address
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">First name</Label>
              <Input id="first_name" {...register("first_name")} />
              {errors.first_name && (
                <p className="text-xs text-destructive">
                  {errors.first_name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" {...register("last_name")} />
              {errors.last_name && (
                <p className="text-xs text-destructive">
                  {errors.last_name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="company">Institution / company (optional)</Label>
              <Input id="company" {...register("company")} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address_1">Street address</Label>
              <Input id="address_1" {...register("address_1")} />
              {errors.address_1 && (
                <p className="text-xs text-destructive">
                  {errors.address_1.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address_2">Apt / suite (optional)</Label>
              <Input id="address_2" {...register("address_2")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register("city")} />
              {errors.city && (
                <p className="text-xs text-destructive">
                  {errors.city.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State / province</Label>
              <Input id="state" {...register("state")} />
              {errors.state && (
                <p className="text-xs text-destructive">
                  {errors.state.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="postcode">ZIP / postcode</Label>
              <Input id="postcode" {...register("postcode")} />
              {errors.postcode && (
                <p className="text-xs text-destructive">
                  {errors.postcode.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country (2-letter)</Label>
              <Input
                id="country"
                maxLength={2}
                {...register("country")}
                placeholder="US"
              />
              {errors.country && (
                <p className="text-xs text-destructive">
                  {errors.country.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" type="tel" {...register("phone")} />
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-2xl border border-border bg-card p-6">
          <legend className="px-2 text-xs uppercase tracking-widest text-muted-foreground">
            Billing address
          </legend>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-background-elevated px-4 py-3">
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 accent-[color:hsl(var(--brand-500))]"
              {...register("billing_same")}
            />
            <span className="text-sm text-foreground">
              Billing address is the same as shipping
            </span>
          </label>

          {!billingSame && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="billing_first_name">First name</Label>
                <Input
                  id="billing_first_name"
                  {...register("billing_first_name")}
                />
                {errors.billing_first_name && (
                  <p className="text-xs text-destructive">
                    {errors.billing_first_name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="billing_last_name">Last name</Label>
                <Input
                  id="billing_last_name"
                  {...register("billing_last_name")}
                />
                {errors.billing_last_name && (
                  <p className="text-xs text-destructive">
                    {errors.billing_last_name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="billing_company">
                  Institution / company (optional)
                </Label>
                <Input
                  id="billing_company"
                  {...register("billing_company")}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="billing_address_1">Street address</Label>
                <Input
                  id="billing_address_1"
                  {...register("billing_address_1")}
                />
                {errors.billing_address_1 && (
                  <p className="text-xs text-destructive">
                    {errors.billing_address_1.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="billing_address_2">
                  Apt / suite (optional)
                </Label>
                <Input
                  id="billing_address_2"
                  {...register("billing_address_2")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="billing_city">City</Label>
                <Input id="billing_city" {...register("billing_city")} />
                {errors.billing_city && (
                  <p className="text-xs text-destructive">
                    {errors.billing_city.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="billing_state">State / province</Label>
                <Input id="billing_state" {...register("billing_state")} />
                {errors.billing_state && (
                  <p className="text-xs text-destructive">
                    {errors.billing_state.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="billing_postcode">ZIP / postcode</Label>
                <Input
                  id="billing_postcode"
                  {...register("billing_postcode")}
                />
                {errors.billing_postcode && (
                  <p className="text-xs text-destructive">
                    {errors.billing_postcode.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="billing_country">Country (2-letter)</Label>
                <Input
                  id="billing_country"
                  maxLength={2}
                  {...register("billing_country")}
                  placeholder="US"
                />
                {errors.billing_country && (
                  <p className="text-xs text-destructive">
                    {errors.billing_country.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="billing_phone">Phone (optional)</Label>
                <Input
                  id="billing_phone"
                  type="tel"
                  {...register("billing_phone")}
                />
              </div>
            </div>
          )}
        </fieldset>

        <CouponPanel />

        <fieldset className="rounded-2xl border border-border bg-card p-6">
          <legend className="flex items-center gap-2 px-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Lock className="h-3 w-3" />
            Payment
          </legend>
          <p className="mb-4 text-xs text-muted-foreground">
            Cards, Apple Pay, and Google Pay are supported. Details go
            straight to Stripe — we never see your card number.
          </p>
          <PaymentElement
            options={{
              layout: { type: "tabs", defaultCollapsed: false },
            }}
          />
        </fieldset>

        <fieldset className="rounded-2xl border border-border bg-card p-6">
          <legend className="px-2 text-xs uppercase tracking-widest text-muted-foreground">
            Order note (optional)
          </legend>
          <textarea
            {...register("customer_note")}
            rows={3}
            placeholder="Anything we should know about your order?"
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring"
          />
        </fieldset>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Payment error</p>
              <p className="mt-1 text-foreground/90">{error}</p>
            </div>
          </div>
        )}
      </div>

      <aside className="h-fit space-y-6 rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-24">
        <div>
          <h2 className="text-lg font-semibold">Order summary</h2>
          <p className="text-xs text-muted-foreground">
            {cart.items_count} item{cart.items_count === 1 ? "" : "s"}
          </p>
        </div>
        <ul className="space-y-3 text-sm">
          {cart.items.map((item) => (
            <li key={item.key} className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                {item.quantity} × {item.name}
              </span>
              <span>{formatPrice(item.totals.line_total, currency)}</span>
            </li>
          ))}
        </ul>
        <Separator />
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatPrice(cart.totals.total_items, currency)}</span>
          </div>
          {parseFloat(cart.totals.total_discount) > 0 && (
            <div className="flex justify-between text-success">
              <span>
                Discount
                {cart.coupons.length > 0 && (
                  <span className="ml-1 text-xs uppercase tracking-wider text-success/80">
                    ({cart.coupons.map((c) => c.code).join(", ")})
                  </span>
                )}
              </span>
              <span>
                −{formatPrice(cart.totals.total_discount, currency)}
              </span>
            </div>
          )}
          {parseFloat(cart.totals.total_shipping ?? "0") > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Shipping</span>
              <span>
                {formatPrice(cart.totals.total_shipping!, currency)}
              </span>
            </div>
          )}
          {parseFloat(cart.totals.total_tax ?? "0") > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span>{formatPrice(cart.totals.total_tax!, currency)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-base font-semibold text-foreground">
            <span>Total</span>
            <span>{formatPrice(cart.totals.total_price, currency)}</span>
          </div>
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={submitting || !stripe}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Pay {formatPrice(cart.totals.total_price, currency)}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          Secure checkout · Stripe · SSL
        </p>
      </aside>
    </form>
  );
}
