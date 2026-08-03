"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/utils";
import type { WCCart } from "@/types";

export function CartPageClient({ initialCart }: { initialCart: WCCart }) {
  const { cart, updateItem, removeItem, isLoading } = useCart();
  const current = cart ?? initialCart;
  const currency = current.totals.currency_code;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
      <ul className="space-y-3">
        {current.items.map((item) => (
          <li
            key={item.key}
            className="flex gap-4 rounded-2xl border border-border bg-card p-4"
          >
            <Link
              href={item.slug ? `/product/${item.slug}` : `/product/${item.id}`}
              className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-border bg-background"
            >
              {item.images[0] && (
                <Image
                  src={item.images[0].src}
                  alt={item.images[0].alt || item.name}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={item.slug ? `/product/${item.slug}` : `/product/${item.id}`}
                    className="font-medium hover:text-primary"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatPrice(item.prices.price, currency)} each
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center rounded-full border border-border">
                  <button
                    type="button"
                    onClick={() => updateItem(item.key, item.quantity - 1)}
                    disabled={isLoading || item.quantity <= 1}
                    className="flex h-9 w-9 items-center justify-center text-muted-foreground disabled:opacity-40"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-6 text-center text-sm">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateItem(item.key, item.quantity + 1)}
                    className="flex h-9 w-9 items-center justify-center text-muted-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="text-base font-semibold">
                  {formatPrice(item.totals.line_total, currency)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="h-fit rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <div className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatPrice(current.totals.total_items, currency)}</span>
          </div>
          {parseFloat(current.totals.total_discount) > 0 && (
            <div className="flex justify-between text-success">
              <span>Discount</span>
              <span>
                -{formatPrice(current.totals.total_discount, currency)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>Shipping</span>
            <span>Calculated at checkout</span>
          </div>
          <Separator />
          <div className="flex justify-between text-base font-semibold text-foreground">
            <span>Total</span>
            <span>{formatPrice(current.totals.total_price, currency)}</span>
          </div>
        </div>

        <Button size="lg" className="mt-6 w-full" asChild>
          <Link href="/checkout">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Proceed to checkout <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Link>
        </Button>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Secure headless checkout · SSL protected
        </p>
      </aside>
    </div>
  );
}
