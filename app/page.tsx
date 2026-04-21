"use client";

import { useTelegram } from "@/components/TelegramProvider";
import { useUser } from "@/hooks/useUser";
import { CompanionCard } from "@/components/companion/CompanionCard";
import { PremiumBanner } from "@/components/companion/PremiumBanner";
import { BottomNav } from "@/components/layout/BottomNav";
import { useRouter } from "next/navigation";
import { Character } from "@/types";

export default function HomePage() {
  const { authHeaders, tg, isReady } = useTelegram();
  const router = useRouter();
  const { characters, limits, user, loading, error, refetch } = useUser(authHeaders, isReady);

  const buyPremium = async () => {
    tg?.HapticFeedback.impactOccurred("medium");
    try {
      const res  = await fetch("/api/payment/invoice", { method: "POST", headers: authHeaders });
      const data = await res.json();
      if (!res.ok || !data.invoiceLink) { tg?.showAlert(data.error ?? "Не удалось создать счёт"); return; }
      tg?.openInvoice(data.invoiceLink, (status) => {
        if (status === "paid") {
          tg?.HapticFeedback.notificationOccurred("success");
          refetch();
          tg?.showAlert("🎉 Premium активирован! Добро пожаловать!");
        }
      });
    } catch { tg?.showAlert("Ошибка соединения"); }
  };

  const openChat = (char: Character) => {
    if (char.is_premium && !limits?.isPremium) {
      tg?.HapticFeedback.notificationOccurred("warning");
      buyPremium();
      return;
    }
    tg?.HapticFeedback.selectionChanged();
    router.push(`/chat/${char.slug}`);
  };

  const msgUsed   = limits?.messages.used  ?? 0;
  const msgLimit  = limits?.messages.limit ?? 20;
  const energyPct = limits?.isPremium ? 100 : Math.min(100, (msgUsed / msgLimit) * 100);

  if (loading) return <LoadingScreen />;
  if (error)   return <ErrorScreen message={error} onRetry={refetch} />;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 88, position: "relative", zIndex: 1 }}>
      {/* Orbs */}
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <div className="bg-orb orb-3" />

      {/* Header */}
      <div style={{
        padding: "max(52px, calc(env(safe-area-inset-top) + 12px)) 20px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(13,11,26,0.88)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      }}>
        <div className="app-logo">Lucid Dreams</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="gem-chip" onClick={buyPremium}>
            <span>💎</span>
            <span>{user?.diamonds ?? 0}</span>
          </div>
          <button className="btn-icon-lumina" onClick={() => router.push("/create")} style={{ fontSize: 20, fontWeight: 700 }}>
            +
          </button>
        </div>
      </div>

      {/* Energy bar */}
      <div style={{ padding: "0 16px 20px" }}>
        <div className="energy-bar">
          <div className="energy-label">Энергия</div>
          <div className="energy-track">
            <div className="energy-fill" style={{ width: `${energyPct}%` }} />
          </div>
          <div className="energy-value">
            {limits?.isPremium ? "∞" : `${msgUsed} / ${msgLimit}`}
          </div>
        </div>
      </div>

      {/* Section label */}
      <div style={{ padding: "0 20px", marginBottom: 12 }}>
        <div className="section-label">Мои компаньоны</div>
      </div>

      {/* Character list */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {characters.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14, padding: "40px 0" }}>
            Загружаем персонажей…
          </p>
        )}
        {characters.map((c, i) => (
          <CompanionCard
            key={c.id}
            character={c}
            locked={c.is_premium === 1 && !limits?.isPremium}
            delayIndex={i}
            onSelect={openChat}
          />
        ))}

        {!limits?.isPremium && <PremiumBanner onBuy={buyPremium} />}
      </div>

      {/* Bottom nav */}
      <BottomNav
        active="home"
        onCreateClick={() => router.push("/create")}
        onFavoritesClick={() => tg?.showAlert("Избранное — скоро!")}
        onShopClick={() => router.push("/shop")}
      />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          border: "2px solid var(--violet)", borderTopColor: "transparent",
          animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
        }} />
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Загрузка...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 48, marginBottom: 12 }}>😔</p>
        <p style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 12 }}>{message}</p>
        <button onClick={onRetry} style={{ color: "var(--violet-light)", fontSize: 14, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          Попробовать снова
        </button>
      </div>
    </div>
  );
}
