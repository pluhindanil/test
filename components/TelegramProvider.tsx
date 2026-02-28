"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

declare global {
  interface Window {
    Telegram: {
      WebApp: TelegramWebApp;
    };
  }
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: TelegramUser };
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  ready(): void;
  expand(): void;
  close(): void;
  sendData(data: string): void;
  showAlert(message: string, callback?: () => void): void;
  showConfirm(message: string, callback: (ok: boolean) => void): void;
  openInvoice(url: string, callback: (status: string) => void): void;
  HapticFeedback: {
    impactOccurred(style: "light" | "medium" | "heavy"): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
    selectionChanged(): void;
  };
  BackButton: {
    show(): void;
    hide(): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
  };
  MainButton: {
    text: string;
    color: string;
    isVisible: boolean;
    isActive: boolean;
    show(): void;
    hide(): void;
    setText(text: string): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
    showProgress(leaveActive?: boolean): void;
    hideProgress(): void;
  };
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  is_premium?: boolean;
  photo_url?: string;
}

interface TelegramContextValue {
  tg: TelegramWebApp | null;
  user: TelegramUser | null;
  initData: string;
  isDark: boolean;
  isReady: boolean;
  /** Common headers to pass to fetch() */
  authHeaders: Record<string, string>;
}

const TelegramContext = createContext<TelegramContextValue>({
  tg: null,
  user: null,
  initData: "",
  isDark: false,
  isReady: false,
  authHeaders: {},
});

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [tg, setTg] = useState<TelegramWebApp | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const webapp = window.Telegram?.WebApp;
    if (!webapp) {
      // Dev mode fallback
      console.warn("Telegram WebApp not found — running in dev mode");
      setIsReady(true);
      return;
    }
    webapp.ready();
    webapp.expand();
    setTg(webapp);
    setIsReady(true);
  }, []);

  const user = tg?.initDataUnsafe?.user ?? null;
  const initData = tg?.initData ?? "";
  const isDark = tg?.colorScheme === "dark";

  const authHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "x-telegram-init-data": initData,
  };

  return (
    <TelegramContext.Provider
      value={{ tg, user, initData, isDark, isReady, authHeaders }}
    >
      <div className={isDark ? "dark" : ""}>{children}</div>
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  return useContext(TelegramContext);
}
