import type { Metadata, Viewport } from "next";
import { publicSiteUrl } from "@/lib/env";
import "./globals.css";

const siteUrl = publicSiteUrl().replace(/\/$/, "");
const description =
  "HaitiPay is a payment gateway for Haitian merchants. Accept MonCash and other local providers with one integration.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "HaitiPay Gateway",
    template: "%s · HaitiPay"
  },
  description,
  applicationName: "HaitiPay Gateway",
  authors: [{ name: "HaitiPay" }],
  keywords: ["payment gateway", "MonCash", "Haiti", "HTG", "merchant"],
  openGraph: {
    type: "website",
    siteName: "HaitiPay Gateway",
    title: "HaitiPay Gateway",
    description,
    url: siteUrl
  },
  twitter: {
    card: "summary_large_image",
    title: "HaitiPay Gateway",
    description
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true }
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
