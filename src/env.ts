import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SITE_NAME: z.string().default("Phantom Labs"),
  NEXT_PUBLIC_USE_MOCKS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  WC_STORE_URL: z.string().url().optional(),
  WC_CONSUMER_KEY: z.string().optional(),
  WC_CONSUMER_SECRET: z.string().optional(),
  WC_API_VERSION: z.string().default("wc/v3"),
  WC_STORE_API_VERSION: z.string().default("wc/store/v1"),

  STRIPE_SECRET_KEY: z.string().optional(),

  REVALIDATE_SECRET: z.string().optional(),

  // --- Customer accounts (WordPress-backed) ---
  // JWT signing secret. Must match `JWT_AUTH_SECRET_KEY` in wp-config.php
  // so tokens minted by either side validate on the other.
  JWT_AUTH_SECRET_KEY: z.string().optional(),
  // Shared server-to-server token gating /wp-json/phantom/v1/auth/register
  // and /activity. Set the same value in WP admin → Phantom Accounts.
  PHANTOM_SERVICE_TOKEN: z.string().optional(),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,
  NEXT_PUBLIC_USE_MOCKS: process.env.NEXT_PUBLIC_USE_MOCKS,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  WC_STORE_URL: process.env.WC_STORE_URL,
  WC_CONSUMER_KEY: process.env.WC_CONSUMER_KEY,
  WC_CONSUMER_SECRET: process.env.WC_CONSUMER_SECRET,
  WC_API_VERSION: process.env.WC_API_VERSION,
  WC_STORE_API_VERSION: process.env.WC_STORE_API_VERSION,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
  JWT_AUTH_SECRET_KEY: process.env.JWT_AUTH_SECRET_KEY,
  PHANTOM_SERVICE_TOKEN: process.env.PHANTOM_SERVICE_TOKEN,
});

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
