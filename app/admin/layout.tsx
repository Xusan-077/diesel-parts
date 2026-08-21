import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeScript } from "@/components/theme-script";
import { Toaster } from "@/components/providers/toaster";

/*
 * The panel is a second root layout. It sits outside the `[lang]` segment
 * because staff are in-house and work in Uzbek only — routing them through the
 * three-locale machinery would triple the translation surface of every table
 * header for no reader.
 *
 * Geist Mono is loaded here and nowhere else. The panel is the only place that
 * lines up SKUs, OEM numbers, stock counts and prices in columns, and those
 * only scan as columns in tabular figures.
 */
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Boshqaruv paneli · Diesel Parts",
  // The panel must never reach an index, whatever the crawler was told elsewhere.
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeScript />
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
