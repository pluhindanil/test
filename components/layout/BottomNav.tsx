"use client";

import { useRouter, usePathname } from "next/navigation";

type NavTab = "home" | "create" | "favorites" | "shop";

interface BottomNavProps {
  active?: NavTab;
  onCreateClick?: () => void;
  onFavoritesClick?: () => void;
  onShopClick?: () => void;
}

export function BottomNav({
  active = "home",
  onCreateClick,
  onFavoritesClick,
  onShopClick,
}: BottomNavProps) {
  const router = useRouter();

  const items: { id: NavTab; label: string; path?: string; onClick?: () => void; icon: React.ReactNode }[] = [
    {
      id: "home",
      label: "Главная",
      path: "/",
      icon: (
        <svg viewBox="0 0 24 24">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      id: "create",
      label: "Создать",
      path: "/create",
      onClick: onCreateClick,
      icon: (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
      ),
    },
    {
      id: "favorites",
      label: "Избранное",
      onClick: onFavoritesClick,
      icon: (
        <svg viewBox="0 0 24 24">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      ),
    },
    {
      id: "shop",
      label: "Магазин",
      path: "/shop",
      onClick: onShopClick,
      icon: (
        <svg viewBox="0 0 24 24">
          <circle cx="9" cy="21" r="1"/>
          <circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
      ),
    },
  ];

  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <div
          key={item.id}
          className={`nav-item ${active === item.id ? "active" : ""}`}
          onClick={() => {
            if (item.onClick) { item.onClick(); return; }
            if (item.path) router.push(item.path);
          }}
        >
          {item.icon}
          <span className="nav-label">{item.label}</span>
        </div>
      ))}
    </nav>
  );
}
