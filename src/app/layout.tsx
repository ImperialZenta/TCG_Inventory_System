import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNavShell } from "@/components/app-nav-shell";
import { SessionGate } from "@/components/session-gate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TCG Chaos Inventory",
  description: "Block-based chaos inventory for Magic: The Gathering",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}>
        <AppNavShell />
        <SessionGate>
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
        </SessionGate>
      </body>
    </html>
  );
}
