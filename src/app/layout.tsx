import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { AppHeader } from "@/components/layout/app-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Dogmarked",
    template: "%s · Dogmarked",
  },
  description:
    "Build your own map of dog-friendly places, discover places shared by others, and understand the actual rules before you arrive.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${dmSans.variable} antialiased`}>
        <div className="flex min-h-dvh flex-col">
          <AppHeader />
          <main className="min-h-0 flex-1 pb-20 md:pb-0">{children}</main>
          <MobileNav />
        </div>
      </body>
    </html>
  );
}
