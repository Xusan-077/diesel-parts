import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "../seller-globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { SellerToaster } from "@/components/seller/ui/toaster";
import { SellerAuthGate } from "@/components/seller/seller-auth-gate";
import { Sidebar } from "@/components/seller/sidebar";
import { Header } from "@/components/seller/header";

/*
 * Root layout for the authenticated side of the seller panel. A second root
 * layout of its own — see app/(seller-auth)/layout.tsx for the sibling that
 * owns /login, and app/admin/layout.tsx / app/(site)/layout.tsx for the two
 * this project already had. Every one of these mounts its own QueryProvider;
 * there is no single shared QueryClient in this app to nest under.
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
          <SellerAuthGate>
            <div className="flex min-h-dvh">
              <Sidebar />
              <div className="flex min-w-0 flex-1 flex-col">
                <Header />
                <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
              </div>
            </div>
          </SellerAuthGate>
          <SellerToaster />
        </QueryProvider>
      </body>
    </html>
  );
}
