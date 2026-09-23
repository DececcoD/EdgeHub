import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const IS_CLERK = process.env.AUTH_PROVIDER === "clerk";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display"
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body"
});

const data = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-data"
});

export const metadata: Metadata = {
  title: "EdgeHub - Compare the market. Understand the edge. Track every decision.",
  description:
    "EdgeHub is a read-only market-intelligence tool for sports bettors: compare licensed sportsbook prices, see implied and no-vig probabilities, and track your decisions. EdgeHub never places wagers or guarantees outcomes."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const html = (
    <html lang="en" className={`${display.variable} ${body.variable} ${data.variable}`}>
      <body>{children}</body>
    </html>
  );

  // ClerkProvider requires a real publishable key to initialize - only
  // render it when real auth is actually opted into (AUTH_PROVIDER=clerk),
  // never as a side effect of the package being installed.
  return IS_CLERK ? <ClerkProvider>{html}</ClerkProvider> : html;
}
