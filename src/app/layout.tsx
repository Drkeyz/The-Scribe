import type { Metadata } from "next";
import { Fraunces, Newsreader, Instrument_Sans } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const manuscript = Newsreader({
  subsets: ["latin"],
  variable: "--font-manuscript",
  style: ["normal", "italic"],
});

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "The Scribe",
  description:
    "An AI writing companion that learns your voice and helps you write the message you carry.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${manuscript.variable} ${sans.variable}`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-vellum-100 text-ink-600 antialiased"
      >
        {children}
      </body>
    </html>
  );
}