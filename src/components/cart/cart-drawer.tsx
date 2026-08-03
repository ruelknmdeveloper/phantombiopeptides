"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, X, ArrowRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/utils";

export function CartDrawer() {
  const {
    cart,
    isDrawerOpen,
    closeDrawer,
    updateItem,
    removeItem,
    isLoading,
  } = useCart();

  const items = cart?.items ?? [];
  const currency = cart?.totals.currency_code ?? "USD";

  return (
    <Sheet open={isDrawerOpen} onOpenChange={(o) => !o && closeDrawer()}>
      <SheetContent className="flex w-full flex-col p-0">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-primary" />
            <SheetTitle>Your cart</SheetTitle>
            {cart && (
              <span className="text-xs text-muted-foreground">
                ({cart.items_count})
              </span>
            )}
          </div>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-background">
              <span className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 blur-xl" />
              <ShoppingBag className="relative h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium">Your cart is empty</p>
              <p className="text-sm text-muted-foreground">
                Explore our research catalog and start building your order.
              </p>
            </div>
            <Button asChild onClick={closeDrawer}>
              <Link href="/shop">Browse the shop</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <ul className="space-y-4">
                {items.map((item) => (
                  <li
                    key={item.key}
                    className="flex gap-4 rounded-xl border border-border/60 bg-background/40 p-3"
                  >
                    <Link
                      href={item.slug ? `/product/${item.slug}` : `/product/${item.id}`}
                      onClick={closeDrawer}
                      className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-background"
                    >
                      {item.images[0] && (
                        <Image
                          src={item.images[0].src}
                          alt={item.images[0].alt || item.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={item.slug ? `/product/${item.slug}` : `/product/${item.id}`}
                          onClick={closeDrawer}
                          className="text-sm font-medium hover:text-primary transition-colors line-clamp-2"
                        >
                          {item.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          disabled={isLoading}
                          className="text-muted-foreground hover:text-destructive transition"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatPrice(item.prices.price, currency)} each
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 rounded-full border border-border">
                          <button
                            type="button"
                            onClick={() =>
                              updateItem(item.key, item.quantity - 1)
                            }
                            disabled={isLoading || item.quantity <= 1}
                            className="flex h-7 w-7 items-center justify-center text-muted-foreground disabled:opacity-40"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-6 text-center text-sm">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateItem(item.key, item.quantity + 1)
                            }
                            disabled={isLoading}
                            className="flex h-7 w-7 items-center justify-center text-muted-foreground"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-sm font-semibold">
                          {formatPrice(item.totals.line_total, currency)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-border bg-background/50 p-6 space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatPrice(cart!.totals.total_items, currency)}</span>
                </div>
                {parseFloat(cart!.totals.total_discount) > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Discount</span>
                    <span>
                      -{formatPrice(cart!.totals.total_discount, currency)}
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
                  <span>{formatPrice(cart!.totals.total_price, currency)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" asChild onClick={closeDrawer}>
                  <Link href="/cart">View cart</Link>
                </Button>
                <Button asChild onClick={closeDrawer}>
                  <Link href="/checkout">
                    Checkout <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
              <p className="text-center text-[11px] text-muted-foreground">
                Secure headless checkout · SSL protected
              </p>
            </div>
          </>
        )}

        <button
          onClick={closeDrawer}
          className="sr-only"
          aria-label="Close cart"
        >
          <X />
        </button>
      </SheetContent>
    </Sheet>
  );
}
