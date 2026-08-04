import type { Metadata } from "next";
import { Suspense } from "react";
import { Manrope } from "next/font/google";
import { AppHeader } from "@/components/layout/app-header";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Dogmarked",
    template: "%s · Dogmarked",
  },
  description:
    "Find a place, save it, tag it, and see it on your map — a personal dog travel map.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} antialiased`}>
        <div className="flex min-h-dvh flex-col bg-[var(--color-canvas)]">
          <Suspense
            fallback={
              <div className="h-14 border-b border-[var(--color-border)] bg-[var(--color-surface)] sm:h-16" />
            }
          >
            <AppHeader />
          </Suspense>
          <main className="min-h-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
