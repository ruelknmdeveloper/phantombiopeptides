import { z } from "zod";
import { decodeHtmlEntities } from "@/lib/utils";

/**
 * Zod schemas mirroring WooCommerce REST v3 + Store API v1.
 * Kept loose (nullable/optional) where Woo's own responses vary.
 *
 * WooCommerce REST returns HTML-encoded strings for titles/descriptions
 * (e.g. "Cognitive &amp; Mood"). We decode entities at parse time so
 * downstream React rendering doesn't double-encode them into "&amp;amp;".
 */

const decodedString = z.string().transform(decodeHtmlEntities);
const decodedStringOptional = z
  .string()
  .optional()
  .default("")
  .transform((s) => decodeHtmlEntities(s ?? ""));

export const wcImageSchema = z.object({
  id: z.number().optional(),
  src: z.string(),
  name: decodedStringOptional,
  alt: decodedStringOptional,
});

export const wcCategorySchema = z.object({
  id: z.number(),
  name: decodedString,
  slug: z.string(),
  description: decodedStringOptional,
  count: z.number().optional().default(0),
  image: wcImageSchema.nullable().optional(),
  parent: z.number().optional().default(0),
});

export const wcAttributeSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  options: z.array(z.string()).default([]),
  variation: z.boolean().optional().default(false),
  visible: z.boolean().optional().default(true),
});

export const wcMetaSchema = z.object({
  key: z.string(),
  // Woo meta values are user-defined and can be strings, numbers,
  // booleans, arrays, or nested objects — accept anything.
  value: z.unknown(),
});

export const wcProductSchema = z.object({
  id: z.number(),
  name: decodedString,
  slug: z.string(),
  permalink: z.string().optional().default(""),
  type: z
    .enum(["simple", "variable", "grouped", "external"])
    .default("simple"),
  status: z.string().default("publish"),
  featured: z.boolean().default(false),
  description: z
    .string()
    .default("")
    .transform((s) => decodeHtmlEntities(s ?? "")),
  short_description: z
    .string()
    .default("")
    .transform((s) => decodeHtmlEntities(s ?? "")),
  sku: z.string().optional().default(""),
  price: z.string().default("0"),
  regular_price: z.string().default("0"),
  sale_price: z.string().default(""),
  on_sale: z.boolean().default(false),
  stock_status: z.enum(["instock", "outofstock", "onbackorder"]).default("instock"),
  stock_quantity: z.number().nullable().optional(),
  manage_stock: z.boolean().default(false),
  average_rating: z.string().default("0"),
  rating_count: z.number().default(0),
  categories: z
    .array(
      z.object({
        id: z.number(),
        name: decodedString,
        slug: z.string(),
        // Inner category descriptions aren't rendered anywhere on the
        // frontend, so leave as an optional plain string to avoid
        // widening the required-field surface via zod transform.
        description: z.string().optional(),
        count: z.number().optional(),
        parent: z.number().optional(),
        image: wcImageSchema.nullable().optional(),
      }),
    )
    .default([]),
  tags: z
    .array(z.object({ id: z.number(), name: decodedString, slug: z.string() }))
    .default([]),
  images: z.array(wcImageSchema).default([]),
  attributes: z.array(wcAttributeSchema).default([]),
  related_ids: z.array(z.number()).default([]),
  meta_data: z.array(wcMetaSchema).optional().default([]),
});

export const wcVariationSchema = z.object({
  id: z.number(),
  price: z.string().default("0"),
  regular_price: z.string().default("0"),
  sale_price: z.string().default(""),
  on_sale: z.boolean().default(false),
  stock_status: z
    .enum(["instock", "outofstock", "onbackorder"])
    .default("instock"),
  stock_quantity: z.number().nullable().optional(),
  image: wcImageSchema.nullable().optional(),
  sku: z.string().optional().default(""),
  attributes: z
    .array(
      z.object({
        id: z.number().optional(),
        name: decodedString,
        option: decodedString,
      }),
    )
    .default([]),
});

export const wcReviewSchema = z.object({
  id: z.number(),
  product_id: z.number(),
  reviewer: z.string(),
  review: z.string(),
  rating: z.number(),
  date_created: z.string(),
  verified: z.boolean().default(false),
});

/* --- Store API (cart) --- */

export const wcCartItemSchema = z.object({
  key: z.string(),
  id: z.number(),
  quantity: z.number(),
  name: z.string(),
  short_description: z.string().optional().default(""),
  // Product slug for building the storefront URL. `permalink` from
  // WooCommerce points at the WordPress admin domain (wpcomstaging or
  // the raw wp URL), which we never want to link to from the headless
  // storefront.
  slug: z.string().optional().default(""),
  permalink: z.string().optional().default(""),
  images: z.array(wcImageSchema).default([]),
  prices: z.object({
    currency_code: z.string(),
    currency_symbol: z.string(),
    currency_minor_unit: z.number().default(2),
    price: z.string(),
    regular_price: z.string(),
    sale_price: z.string(),
  }),
  totals: z.object({
    line_subtotal: z.string(),
    line_total: z.string(),
  }),
});

export const wcCartSchema = z.object({
  items: z.array(wcCartItemSchema).default([]),
  items_count: z.number().default(0),
  needs_shipping: z.boolean().default(false),
  coupons: z
    .array(z.object({ code: z.string(), discount_type: z.string().optional() }))
    .default([]),
  totals: z.object({
    currency_code: z.string(),
    currency_symbol: z.string(),
    currency_minor_unit: z.number().default(2),
    total_items: z.string(),
    total_discount: z.string(),
    total_shipping: z.string().optional().default("0"),
    total_tax: z.string().optional().default("0"),
    total_price: z.string(),
  }),
});

/* --- Store API (checkout) --- */

export const wcAddressSchema = z.object({
  first_name: z.string(),
  last_name: z.string(),
  company: z.string().optional().default(""),
  address_1: z.string(),
  address_2: z.string().optional().default(""),
  city: z.string(),
  state: z.string(),
  postcode: z.string(),
  country: z.string(),
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
});

export const wcCheckoutResponseSchema = z.object({
  order_id: z.number(),
  status: z.string(),
  order_key: z.string().optional().default(""),
  order_number: z.string().optional().default(""),
  customer_note: z.string().optional().default(""),
  customer_id: z.number().optional().default(0),
  billing_address: wcAddressSchema.optional(),
  shipping_address: wcAddressSchema.optional(),
  payment_method: z.string().optional().default(""),
  payment_result: z
    .object({
      payment_status: z
        .enum(["success", "failure", "pending", "error"])
        .optional(),
      payment_details: z
        .array(
          z.object({
            key: z.string(),
            value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
          }),
        )
        .default([]),
      redirect_url: z.string().optional().default(""),
    })
    .optional(),
});

export const wcCouponSchema = z.object({
  id: z.number(),
  code: z.string(),
  amount: z.string(),
  discount_type: z.enum([
    "fixed_cart",
    "percent",
    "fixed_product",
    "percent_product",
  ]),
  minimum_amount: z.string().optional().default("0"),
  maximum_amount: z.string().optional().default("0"),
  usage_limit: z.number().nullable().optional().default(0),
  usage_count: z.number().optional().default(0),
  date_expires: z.string().nullable().optional(),
  product_ids: z.array(z.number()).default([]),
  excluded_product_ids: z.array(z.number()).default([]),
  product_categories: z.array(z.number()).default([]),
  excluded_product_categories: z.array(z.number()).default([]),
  individual_use: z.boolean().optional().default(false),
  free_shipping: z.boolean().optional().default(false),
});

export type WCImage = z.infer<typeof wcImageSchema>;
export type WCCategory = z.infer<typeof wcCategorySchema>;
export type WCAttribute = z.infer<typeof wcAttributeSchema>;
export type WCProduct = z.infer<typeof wcProductSchema>;
export type WCVariation = z.infer<typeof wcVariationSchema>;
export type WCReview = z.infer<typeof wcReviewSchema>;
export type WCCart = z.infer<typeof wcCartSchema>;
export type WCCartItem = z.infer<typeof wcCartItemSchema>;
export type WCAddress = z.infer<typeof wcAddressSchema>;
export type WCCheckoutResponse = z.infer<typeof wcCheckoutResponseSchema>;
export type WCCoupon = z.infer<typeof wcCouponSchema>;
