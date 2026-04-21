"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTelegram } from "@/components/TelegramProvider";
import { BottomNav } from "@/components/layout/BottomNav";

const DIAMOND_PACKS = [
  { id: 1, amount: 100,  bonus: 0,   label: "Базовый пакет",  stars: 99,  style: "violet" as const },
  { id: 2, amount: 500,  bonus: 50,  label: "Популярный",     stars: 399, style: "pink"   as const },
  { id: 3, amount: 1000, bonus: 200, label: "Максимум",        stars: 699, style: "cyan"   as const },
];

const CARD_GLOW: Record<string, string> = {
  violet: "rgba(139,92,246,0.12)",
  pink:   "rgba(236,72,153,0.10)",
  cyan:   "rgba(34,211,238,0.08)",
};
const PRICE_GRAD: Record<string, string> = {
  violet: "linear-gradient(135deg, #8b5cf6, #ec4899)",
  pink:   "linear-gradient(120deg, #ec4899, #f59e0b)",
  cyan:   "linear-gradient(135deg, #22d3ee, #8b5cf6)",
};

export default function ShopPage() {
  const { tg, authHeaders, isReady } = useTelegram();
  const router = useRouter();
  const [buying, setBuying] = useState<number | null>(null);

  const buyPremium = async () => {
    tg?.HapticFeedback.impactOccurred("medium");
    try {
      const res  = await fetch("/api/payment/invoice", { method: "POST", headers: authHeaders });
      const data = await res.json();
      if (!res.ok || !data.invoiceLink) { tg?.showAlert(data.error ?? "Не удалось создать счёт"); return; }
      tg?.openInvoice(data.invoiceLink, (status) => {
        if (status === "paid") {
          tg?.HapticFeedback.notificationOccurred("success");
          tg?.showAlert("🎉 Premium активирован!");
        }
      });
    } catch { tg?.showAlert("Ошибка соединения"); }
  };

  const buyDiamonds = (pack: typeof DIAMOND_PACKS[number]) => {
    tg?.HapticFeedback.impactOccurred("light");
    tg?.showAlert(`Покупка алмазов — скоро!\n${pack.amount}💎 за ${pack.stars}⭐`);
  };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 88, position: "relative" }}>
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-3" />

      {/* Header */}
      <div style={{
        padding: "max(52px, calc(env(safe-area-inset-top) + 12px)) 20px 16px",
        display: "flex", alignItems: "center", gap: 12,
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(13,11,26,0.88)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      }}>
        <button className="back-btn" onClick={() => router.push("/")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
          Магазин
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        {/* Diamond packs */}
        <div className="section-label" style={{ marginBottom: 14 }}>💎 Алмазы</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {DIAMOND_PACKS.map((pack, i) => (
            <div
              key={pack.id}
              className={`companion-card card-${pack.style} anim-fade-up`}
              style={{ animationDelay: `${i * 0.05}s`, justifyContent: "space-between" }}
              onClick={() => buyDiamonds(pack)}
            >
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                  {pack.amount} 💎
                  {pack.bonus > 0 && (
                    <span style={{ fontSize: 11, color: "var(--amber)", marginLeft: 8 }}>+{pack.bonus} бонус</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{pack.label}</div>
              </div>
              <div style={{
                background: PRICE_GRAD[pack.style],
                padding: "8px 18px", borderRadius: 999,
                fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700,
                color: pack.style === "pink" ? "#1a0800" : "#fff",
              }}>
                {pack.stars}⭐
              </div>
            </div>
          ))}
        </div>

        {/* Premium */}
        <div className="section-label" style={{ marginBottom: 14 }}>⭐ Premium</div>
        <div className="premium-banner anim-fade-up delay-4" onClick={buyPremium}>
          <div className="banner-eyebrow">✦ Лучший выбор</div>
          <div className="banner-title">Premium подписка</div>
          <div className="banner-desc">
            Безлимитные сообщения · HD генерация · Эксклюзивные сцены · Все персонажи
          </div>
          <div className="banner-cta">⭐ 349⭐ / месяц</div>
        </div>

        {/* Features list */}
        <div style={{ marginTop: 20, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px 18px" }}>
          {[
            { icon: "💬", text: "Безлимитные сообщения каждый день" },
            { icon: "🖼", text: "HD AI-фото каждые 3 сообщения" },
            { icon: "🔓", text: "Доступ ко всем персонажам" },
            { icon: "⚡", text: "Приоритетная генерация" },
          ].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{f.icon}</span>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      <BottomNav active="shop" onCreateClick={() => router.push("/create")} onFavoritesClick={() => tg?.showAlert("Избранное — скоро!")} />
    </div>
  );
}
