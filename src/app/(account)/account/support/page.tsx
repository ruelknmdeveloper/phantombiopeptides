import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, Mail, MessageCircle, Package, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Support",
  robots: { index: false, follow: false },
};

const LINKS = [
  {
    icon: Mail,
    title: "Contact us",
    body: "Email response within one business day.",
    href: "/contact",
    cta: "Open contact form",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp",
    body: "Fastest way to reach us during business hours.",
    href: "https://wa.me/",
    cta: "Chat on WhatsApp",
    external: true,
  },
  {
    icon: Package,
    title: "Order tracking",
    body: "Find your latest order status and tracking info.",
    href: "/account/orders",
    cta: "View orders",
  },
  {
    icon: FileText,
    title: "FAQ",
    body: "Shipping, refunds, product safety, research use policy.",
    href: "/faq",
    cta: "Browse FAQ",
  },
];

export default function SupportPage() {
  return (
    <div className="space-y-8">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <LifeBuoy className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-medium">Support</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;re here whenever you need us.
          </p>
        </div>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              target={l.external ? "_blank" : undefined}
              rel={l.external ? "noopener" : undefined}
              className="group block h-full rounded-2xl border border-border bg-card p-5 transition hover:border-brand-300 hover:bg-brand-50/30"
            >
              <l.icon className="h-5 w-5 text-brand-600" />
              <p className="mt-3 text-sm font-medium">{l.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{l.body}</p>
              <p className="mt-3 text-xs font-medium text-brand-600 group-hover:text-brand-500">
                {l.cta} →
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl border border-dashed border-border p-5 text-xs text-muted-foreground">
        Prefer a live chat window on the site? We&apos;re rolling out an
        in-app helpdesk later this quarter. For now, WhatsApp is the fastest
        real-time channel.
      </div>
    </div>
  );
}
