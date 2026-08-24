import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "../seller-globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { SellerToaster } from "@/components/seller/ui/toaster";

/*
 * Root layout for the whole standalone seller panel — both its public
 * sign-in screen (/seller/login) and its authenticated side, grouped under
 * `(panel)` and wrapped there by the auth gate and the sidebar/header.
 *
 * One root rather than two: the login screen used to have its own root
 * layout (app/(seller-auth)/layout.tsx, now gone) purely so the
 * authenticated side's `SellerAuthGate` would not wrap it and bounce every
 * signed-out visitor straight back to the page they were already on. The
 * `(panel)` route group does that job now — it adds no path segment, so
 * `/seller/customers` etc. are unchanged — without needing a second
 * `<html>`/`<body>`.
 */
const sellerSans = Geist({ variable: "--font-seller-sans", subsets: ["latin"] });
const sellerMono = JetBrains_Mono({
  variable: "--font-seller-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Seller Panel · Diesel Parts",
  robots: { index: false, follow: false },
};

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`seller-root ${sellerSans.variable} ${sellerMono.variable} antialiased`}>
        <QueryProvider>
          {children}
          <SellerToaster />
        </QueryProvider>
      </body>
    </html>
  );
}
