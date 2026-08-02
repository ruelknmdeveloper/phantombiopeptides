import type { Metadata, Viewport } from "next";
import { Geist_Mono, Barlow, Barlow_Condensed } from "next/font/google";
import Script from "next/script";
import { CategoriesService } from "@/services/categories";
import { Providers } from "@/providers";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { AgeGate } from "@/components/common/age-gate";
import { BackToTop } from "@/components/common/back-to-top";
import { PromoModal } from "@/components/marketing/promo-modal";
import { TikTokPixel } from "@/components/common/tiktok-pixel";
import { buildMetadata, organizationJsonLd } from "@/lib/seo";
import "./globals.css";

// Body / UI sans: Barlow — closest free Google Fonts match to
// Adidas' proprietary AdihausDIN (geometric, slightly condensed,
// strong x-height).
const sans = Barlow({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});
// Display headings: Barlow Condensed for a punchier athletic feel
// on titles — pairs cleanly with Barlow at body sizes.
const display = Barlow_Condensed({
  variable: "--font-brand-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = buildMetadata({});

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Cart is intentionally NOT read here: `CartService.get()` calls
  // `cookies()`, which forces every route through this layout to be
  // dynamic. CartProvider fetches the cart client-side on mount so
  // /product/[slug] and /category/[slug] can stay static + ISR.
  const categories = await CategoriesService.list().catch(() => []);

  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${mono.variable} antialiased`}
    >
      <body className="min-h-screen bg-background text-foreground flex flex-col font-sans">
        <Script
          id="ld-org"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd()),
          }}
        />
        <TikTokPixel />
        <Providers initialCart={null}>
          <AgeGate />
          <PromoModal />
          <AnnouncementBar />
          <Navbar />
          <CartDrawer />
          <main className="flex-1">{children}</main>
          <Footer categories={categories} />
          <BackToTop />
        </Providers>
      </body>
    </html>
  );
}
