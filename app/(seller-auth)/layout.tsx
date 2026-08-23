import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "../seller-globals.css";
import { SellerToaster } from "@/components/seller/ui/toaster";
import { QueryProvider } from "@/components/providers/query-provider";

/*
 * Root layout for the seller panel's one public route (/login). A second
 * root layout, the same way app/admin/layout.tsx and app/(site)/layout.tsx
 * are — this project has no single top-level app/layout.tsx; each top-level
 * section owns its own <html>/<body>. See app/seller/layout.tsx for the
 * authenticated side of this same panel.
 */
const sellerSans = Geist({ variable: "--font-seller-sans", subsets: ["latin"] });
const sellerMono = JetBrains_Mono({
  variable: "--font-seller-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Kirish · Seller Panel",
  robots: { index: false, follow: false },
};

export default function SellerAuthLayout({ children }: { children: React.ReactNode }) {
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
