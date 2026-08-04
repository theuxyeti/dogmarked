import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { AppHeader } from "@/components/layout/app-header";
import { MobileNav } from "@/components/layout/mobile-nav";
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
    "Build your own map of dog-friendly places, discover places shared by others, and understand the actual rules before you arrive.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} antialiased`}>
        <div className="flex min-h-dvh flex-col">
          <AppHeader />
          <main className="min-h-0 flex-1 pb-20 xl:pb-0">{children}</main>
          <MobileNav />
        </div>
      </body>
    </html>
  );
}
