import "server-only";
import { cookies } from "next/headers";
import { ProductsService } from "./products";
import { CouponsService } from "./coupons";
import type { WCCart, WCCoupon, WCProduct, WCVariation } from "@/types";

/**
 * Cart is stored on our side (httpOnly cookie), not in WooCommerce.
 *
 * Background: WooCommerce Store API's guest cart persistence relies on
 * PHP sessions, which WordPress.com's multi-tenant hosting does not
 * reliably maintain between requests — items were being POSTed
 * successfully but disappearing on the very next GET /cart. Rather
 * than fight the hosting, we hold the cart line items ourselves,
 * hydrate them with live product data from the Woo REST API on read,
 * and submit the full basket as a Woo order at checkout time via the
 * authenticated REST endpoint (which does not depend on sessions).
 *
 * Cookie shape (JSON-encoded array of):
 *   { id: number; quantity: number; variation?: [{attribute, value}] }
 */

const CART_COOKIE = "pl_cart_items";
const COUPON_COOKIE = "pl_cart_coupons";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Invalid-coupon signal used by applyCoupon. */
export class CouponError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "not_found"
      | "expired"
      | "usage_limit"
      | "minimum_amount"
      | "not_applicable"
      | "already_applied",
  ) {
    super(message);
    this.name = "CouponError";
  }
}

interface CartLineItem {
  id: number;
  quantity: number;
  variation?: Array<{ attribute: string; value: string }>;
  /** WooCommerce variation id for variable products. */
  variation_id?: number;
}

function variationHash(v?: CartLineItem["variation"]): string {
  if (!v || v.length === 0) return "";
  const norm = v
    .map((x) => `${x.attribute.toLowerCase()}=${x.value.toLowerCase()}`)
    .sort()
    .join("|");
  // Simple stable hash — good enough for a cart key.
  let h = 0;
  for (let i = 0; i < norm.length; i++) h = (h * 31 + norm.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function itemKey(item: CartLineItem): string {
  // Prefer the concrete WC variation id when we have it (guaranteed
  // unique per line), fall back to hashing the raw attributes.
  if (item.variation_id) return `k${item.id}-v${item.variation_id}`;
  const suffix = variationHash(item.variation);
  return suffix ? `k${item.id}-${suffix}` : `k${item.id}`;
}

function sameLine(a: CartLineItem, b: CartLineItem): boolean {
  return itemKey(a) === itemKey(b);
}

async function readCartItems(): Promise<CartLineItem[]> {
  const store = await cookies();
  const raw = store.get(CART_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is CartLineItem =>
          typeof x?.id === "number" && typeof x?.quantity === "number",
      )
      .map((x) => ({
        id: x.id,
        quantity: x.quantity,
        variation: x.variation,
        variation_id:
          typeof x.variation_id === "number" ? x.variation_id : undefined,
      }));
  } catch {
    return [];
  }
}

async function writeCartItems(items: CartLineItem[]) {
  const store = await cookies();
  store.set(CART_COOKIE, JSON.stringify(items), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

async function readCoupons(): Promise<string[]> {
  const store = await cookies();
  const raw = store.get(COUPON_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string" && x.trim() !== "")
      .map((x) => x.trim());
  } catch {
    return [];
  }
}

async function writeCoupons(codes: string[]) {
  const store = await cookies();
  if (codes.length === 0) {
    store.delete(COUPON_COOKIE);
    return;
  }
  store.set(COUPON_COOKIE, JSON.stringify(codes), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * Compute the discount a coupon takes off the current cart, plus the
 * per-line adjustments so line totals can be redisplayed net-of-discount.
 * Only supports the four core Woo discount types.
 */
function applyCoupon(
  coupon: WCCoupon,
  items: WCCart["items"],
  products: Map<number, WCProduct>,
): number {
  const amount = parseFloat(coupon.amount) || 0;
  const eligible = items.filter((it) => {
    const p = products.get(it.id);
    if (!p) return false;
    const productMatches =
      coupon.product_ids.length === 0 ||
      coupon.product_ids.includes(it.id);
    const productExcluded = coupon.excluded_product_ids.includes(it.id);
    const catIds = p.categories.map((c) => c.id);
    const catMatches =
      coupon.product_categories.length === 0 ||
      catIds.some((id) => coupon.product_categories.includes(id));
    const catExcluded = catIds.some((id) =>
      coupon.excluded_product_categories.includes(id),
    );
    return productMatches && !productExcluded && catMatches && !catExcluded;
  });

  const eligibleSubtotal = eligible.reduce(
    (s, it) => s + parseFloat(it.totals.line_subtotal),
    0,
  );

  switch (coupon.discount_type) {
    case "percent":
      return round2((eligibleSubtotal * amount) / 100);
    case "fixed_cart":
      return Math.min(round2(amount), eligibleSubtotal);
    case "percent_product":
      return round2((eligibleSubtotal * amount) / 100);
    case "fixed_product":
      return round2(
        eligible.reduce(
          (s, it) => s + Math.min(amount, parseFloat(it.prices.price)) * it.quantity,
          0,
        ),
      );
    default:
      return 0;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function emptyCart(): WCCart {
  return {
    items: [],
    items_count: 0,
    needs_shipping: false,
    coupons: [],
    totals: {
      currency_code: "USD",
      currency_symbol: "$",
      currency_minor_unit: 2,
      total_items: "0.00",
      total_discount: "0.00",
      total_shipping: "0.00",
      total_tax: "0.00",
      total_price: "0.00",
    },
  };
}

function buildLineItem(
  item: CartLineItem,
  product: WCProduct,
  variation: WCVariation | null,
): WCCart["items"][number] {
  // Variation price / image / stock take precedence over the parent
  // product's values when the customer picked a specific variation.
  const unitPrice = parseFloat(variation?.price || product.price) || 0;
  const regularPrice = variation?.regular_price || product.regular_price;
  const salePrice = variation?.sale_price || product.sale_price;
  const lineSubtotal = unitPrice * item.quantity;
  const image = variation?.image ?? product.images[0];
  const doseSuffix = item.variation
    ?.map((v) => v.value)
    .join(" / ");
  const displayName = doseSuffix
    ? `${product.name} — ${doseSuffix}`
    : product.name;
  return {
    key: itemKey(item),
    id: product.id,
    quantity: item.quantity,
    name: displayName,
    short_description: product.short_description,
    slug: product.slug,
    permalink: product.permalink,
    images: image ? [image] : [],
    prices: {
      currency_code: "USD",
      currency_symbol: "$",
      currency_minor_unit: 2,
      price: unitPrice.toFixed(2),
      regular_price: regularPrice,
      sale_price: salePrice,
    },
    totals: {
      line_subtotal: lineSubtotal.toFixed(2),
      line_total: lineSubtotal.toFixed(2),
    },
  };
}

async function hydrateCart(
  items: CartLineItem[],
  couponCodes: string[] = [],
): Promise<WCCart> {
  if (items.length === 0) return emptyCart();
  const productsPromise = Promise.all(
    items.map((it) => ProductsService.getById(it.id).catch(() => null)),
  );
  // For every line that has a variation_id, fetch the full variations
  // list for the parent product once and pick the matching variant.
  const uniqueVariableIds = Array.from(
    new Set(
      items
        .filter((it) => typeof it.variation_id === "number")
        .map((it) => it.id),
    ),
  );
  const variationListsPromise = Promise.all(
    uniqueVariableIds.map((pid) =>
      ProductsService.getVariations(pid).catch(() => [] as WCVariation[]),
    ),
  );
  const [products, variationLists] = await Promise.all([
    productsPromise,
    variationListsPromise,
  ]);
  const variationsByProductId = new Map<number, WCVariation[]>();
  uniqueVariableIds.forEach((pid, i) =>
    variationsByProductId.set(pid, variationLists[i] ?? []),
  );

  const cartItems: WCCart["items"] = [];
  for (let i = 0; i < items.length; i++) {
    const p = products[i];
    if (!p) continue;
    const line = items[i];
    let variation: WCVariation | null = null;
    if (line.variation_id) {
      const list = variationsByProductId.get(line.id) ?? [];
      variation =
        list.find((v) => v.id === line.variation_id) ?? null;
    }
    cartItems.push(buildLineItem(line, p, variation));
  }
  const subtotal = cartItems.reduce(
    (s, it) => s + parseFloat(it.totals.line_subtotal),
    0,
  );

  // Resolve applied coupons and roll them into the cart totals. Any
  // coupon that no longer exists in Woo (deleted or renamed) is
  // silently dropped so a stale cookie doesn't crash the flow.
  const appliedCoupons: Array<{ code: string; discount_type: string }> = [];
  let totalDiscount = 0;
  if (couponCodes.length > 0) {
    const productMap = new Map<number, WCProduct>();
    for (const p of products) if (p) productMap.set(p.id, p);
    const resolved = await Promise.all(
      couponCodes.map((code) => CouponsService.getByCode(code)),
    );
    for (const coupon of resolved) {
      if (!coupon) continue;
      const eligibleSubtotal = subtotal;
      const min = parseFloat(coupon.minimum_amount || "0");
      if (min > 0 && eligibleSubtotal < min) continue;
      const discount = applyCoupon(coupon, cartItems, productMap);
      if (discount <= 0) continue;
      totalDiscount += discount;
      appliedCoupons.push({
        code: coupon.code,
        discount_type: coupon.discount_type,
      });
    }
  }
  // Never discount past zero.
  totalDiscount = Math.min(round2(totalDiscount), subtotal);
  const totalPrice = round2(subtotal - totalDiscount);

  return {
    items: cartItems,
    items_count: cartItems.reduce((s, it) => s + it.quantity, 0),
    needs_shipping: cartItems.length > 0,
    coupons: appliedCoupons,
    totals: {
      currency_code: "USD",
      currency_symbol: "$",
      currency_minor_unit: 2,
      total_items: subtotal.toFixed(2),
      total_discount: totalDiscount.toFixed(2),
      total_shipping: "0.00",
      total_tax: "0.00",
      total_price: totalPrice.toFixed(2),
    },
  };
}

export const CartService = {
  async get(): Promise<WCCart> {
    return hydrateCart(await readCartItems(), await readCoupons());
  },

  async addItem(
    productId: number,
    quantity = 1,
    variation?: Array<{ attribute: string; value: string }>,
    variationId?: number,
  ): Promise<WCCart> {
    const items = await readCartItems();
    const newLine: CartLineItem = {
      id: productId,
      quantity,
      variation,
      variation_id: variationId,
    };
    const existing = items.find((it) => sameLine(it, newLine));
    if (existing) existing.quantity += quantity;
    else items.push(newLine);
    await writeCartItems(items);
    return hydrateCart(items, await readCoupons());
  },

  async updateItem(key: string, quantity: number): Promise<WCCart> {
    let items = await readCartItems();
    if (quantity <= 0) {
      items = items.filter((it) => itemKey(it) !== key);
    } else {
      const item = items.find((it) => itemKey(it) === key);
      if (item) item.quantity = quantity;
    }
    await writeCartItems(items);
    return hydrateCart(items, await readCoupons());
  },

  async removeItem(key: string): Promise<WCCart> {
    const items = (await readCartItems()).filter(
      (it) => itemKey(it) !== key,
    );
    await writeCartItems(items);
    return hydrateCart(items, await readCoupons());
  },

  /**
   * Validate a coupon against Woo, verify it applies to the current
   * cart, then persist it in the coupon cookie so hydrateCart will
   * fold the discount into totals from now on.
   */
  async applyCoupon(code: string): Promise<WCCart> {
    const trimmed = code.trim();
    if (!trimmed) throw new CouponError("Enter a coupon code.", "not_found");
    const existing = await readCoupons();
    if (existing.length > 0) {
      throw new CouponError(
        "Only one coupon can be used per order. Remove the current coupon first.",
        "already_applied",
      );
    }
    const coupon = await CouponsService.getByCode(trimmed);
    if (!coupon) {
      throw new CouponError("That code isn't valid.", "not_found");
    }
    if (coupon.date_expires) {
      const exp = new Date(coupon.date_expires);
      if (!isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        throw new CouponError("That coupon has expired.", "expired");
      }
    }
    if (
      coupon.usage_limit != null &&
      coupon.usage_limit > 0 &&
      coupon.usage_count >= coupon.usage_limit
    ) {
      throw new CouponError(
        "That coupon has been fully redeemed.",
        "usage_limit",
      );
    }

    // Diagnose common "doesn't apply" reasons up front so the user
    // gets a specific message instead of a vague failure.
    const amount = parseFloat(coupon.amount) || 0;
    if (amount <= 0) {
      throw new CouponError(
        "This coupon has no value set. Ask an admin to update its amount in WooCommerce.",
        "not_applicable",
      );
    }
    const supportedTypes = new Set([
      "percent",
      "fixed_cart",
      "percent_product",
      "fixed_product",
    ]);
    if (!supportedTypes.has(coupon.discount_type)) {
      throw new CouponError(
        `Discount type "${coupon.discount_type}" isn't supported yet — use Percentage, Fixed cart, or Fixed product.`,
        "not_applicable",
      );
    }

    // Hydrate the current cart to check applicability + minimum spend.
    const items = await readCartItems();
    const preview = await hydrateCart(items, [...existing, trimmed]);
    const applied = preview.coupons.some(
      (c) => c.code.toLowerCase() === trimmed.toLowerCase(),
    );
    if (!applied) {
      const min = parseFloat(coupon.minimum_amount || "0");
      if (min > 0) {
        throw new CouponError(
          `Order subtotal must be at least $${min.toFixed(2)} to use this coupon.`,
          "minimum_amount",
        );
      }
      const hasProductRestrictions =
        coupon.product_ids.length > 0 ||
        coupon.excluded_product_ids.length > 0 ||
        coupon.product_categories.length > 0 ||
        coupon.excluded_product_categories.length > 0;
      if (hasProductRestrictions) {
        throw new CouponError(
          "This coupon only applies to specific products or categories that aren't in your cart.",
          "not_applicable",
        );
      }
      throw new CouponError(
        "This coupon doesn't apply to your current cart. Check the coupon's usage restrictions in WooCommerce.",
        "not_applicable",
      );
    }

    // If it's an individual-use coupon, drop any others first.
    const next = coupon.individual_use
      ? [trimmed]
      : [...existing, trimmed];
    await writeCoupons(next);
    return hydrateCart(items, next);
  },

  async removeCoupon(code: string): Promise<WCCart> {
    const trimmed = code.trim().toLowerCase();
    const next = (await readCoupons()).filter(
      (c) => c.toLowerCase() !== trimmed,
    );
    await writeCoupons(next);
    return hydrateCart(await readCartItems(), next);
  },

  /**
   * Raw line items — used at checkout to hand off to Woo via the
   * authenticated REST /orders endpoint.
   */
  async getLineItems(): Promise<CartLineItem[]> {
    return readCartItems();
  },

  /**
   * Applied coupon codes — used at order write time so Woo records the
   * coupons on the order via coupon_lines.
   */
  async getAppliedCoupons(): Promise<string[]> {
    return readCoupons();
  },

  async clear(): Promise<void> {
    await writeCartItems([]);
    await writeCoupons([]);
  },
};
