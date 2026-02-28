import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { TelegramProvider } from "@/components/TelegramProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "AI Companions",
  description: "Chat with your AI companion",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Telegram WebApp SDK */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className={`${inter.className} bg-gray-950 text-white min-h-screen`}>
        <TelegramProvider>{children}</TelegramProvider>
      </body>
    </html>
  );
}
