import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HaitiPay Gateway MVP",
  description: "Supabase-based payment gateway MVP for Haiti"
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
