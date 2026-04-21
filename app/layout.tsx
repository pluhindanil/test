import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import Script from "next/script";
import { TelegramProvider } from "@/components/TelegramProvider";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
  weight: ["300", "400", "500"],
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lucid Dreams",
  description: "Chat with your AI companion",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className={`${dmSans.variable} ${syne.variable}`}>
        <TelegramProvider>{children}</TelegramProvider>
      </body>
    </html>
  );
}
