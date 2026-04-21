"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTelegram } from "@/components/TelegramProvider";

interface Character {
  id: number;
  slug: string;
  name: string;
  description: string;
  style: string;
  avatar_url: string;
  is_premium: number;
}

interface Limits {
  messages: { used: number; limit: number | null };
  images:   { used: number; limit: number | null };
  isPremium: boolean;
}

interface ApiUser {
  firstName: string | null;
  username: string | null;
  diamonds?: number;
}

const CHAR_RING: Record<string, "ring-violet" | "ring-pink" | "ring-cyan"> = {
  aria:  "ring-violet",
  yuki:  "ring-pink",
  sofia: "ring-cyan",
  luna:  "ring-pink",
};

const CHAR_COLORS: Record<string, [string, string]> = {
  aria:  ["#8b5cf6", "#ec4899"],
  yuki:  ["#ec4899", "#3b82f6"],
  sofia: ["#22d3ee", "#8b5cf6"],
  luna:  ["#7c3aed", "#ec4899"],
};

const CHAR_INITIALS: Record<string, string> = {
  aria:  "A",
  yuki:  "ユ",
  sofia: "С",
  luna:  "Л",
};

export default function HomePage() {
  const { authHeaders, tg, isReady } = useTelegram();
  const router = useRouter();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [limits, setLimits]         = useState<Limits | null>(null);
  const [apiUser, setApiUser]       = useState<ApiUser | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  useEffect(() => {
    if (!isReady) return;
    fetch("/api/user", { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => {
        setCharacters(data.characters ?? []);
        setLimits(data.limits ?? null);
        setApiUser(data.user ?? null);
      })
      .catch(() => setError("Не удалось загрузить данные"))
      .finally(() => setLoading(false));
  }, [isReady]);

  const openChat = (char: Character) => {
    if (char.is_premium && !limits?.isPremium) {
      tg?.HapticFeedback.notificationOccurred("warning");
      buyPremium();
      return;
    }
    tg?.HapticFeedback.selectionChanged();
    router.push(`/chat/${char.slug}`);
  };

  const buyPremium = async () => {
    tg?.HapticFeedback.impactOccurred("medium");
    try {
      const res = await fetch("/api/payment/invoice", { method: "POST", headers: authHeaders });
      const data = await res.json();
      if (!res.ok || !data.invoiceLink) {
        tg?.showAlert(data.error ?? "Не удалось создать счёт");
        return;
      }
      tg?.openInvoice(data.invoiceLink, (status) => {
        if (status === "paid") {
          tg?.HapticFeedback.notificationOccurred("success");
          fetch("/api/user", { headers: authHeaders })
            .then((r) => r.json())
            .then((d) => setLimits(d.limits ?? null));
          tg?.showAlert("🎉 Premium активирован! Добро пожаловать!");
        }
      });
    } catch {
      tg?.showAlert("Ошибка соединения");
    }
  };

  if (loading) return <LoadingScreen />;
  if (error)   return <ErrorScreen message={error} />;

  const msgUsed  = limits?.messages.used  ?? 0;
  const msgLimit = limits?.messages.limit ?? 20;
  const energyPct = limits?.isPremium
    ? 100
    : Math.min(100, (msgUsed / msgLimit) * 100);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 80, position: "relative", zIndex: 1 }}>
      {/* Background orbs */}
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <div className="bg-orb orb-3" />

      {/* ── Header ── */}
      <div style={{
        padding: "max(52px, calc(env(safe-area-inset-top) + 12px)) 20px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "rgba(13,11,26,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}>
        <div className="app-logo">Lucid Dreams</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Gem chip */}
          <div className="gem-chip" onClick={buyPremium}>
            <span style={{ fontSize: 14 }}>💎</span>
            <span>{apiUser?.diamonds ?? 0}</span>
          </div>
          {/* Add — coming soon */}
          <button
            className="btn-icon-lumina"
            onClick={() => tg?.showAlert("Создание персонажей — скоро!")}
            style={{ fontSize: 20, fontWeight: 700 }}
          >
            +
          </button>
        </div>
      </div>

      {/* ── Energy bar ── */}
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

      {/* ── Section label ── */}
      <div style={{ padding: "0 20px", marginBottom: 12 }}>
        <div className="section-label">Мои компаньоны</div>
      </div>

      {/* ── Character list ── */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {characters.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14, padding: "40px 0" }}>
            Загружаем персонажей…
          </p>
        )}

        {characters.map((c, i) => {
          const locked = c.is_premium === 1 && !limits?.isPremium;
          const ring   = CHAR_RING[c.slug] ?? "ring-violet";
          const colors = CHAR_COLORS[c.slug] ?? ["#8b5cf6", "#ec4899"];
          const initial = CHAR_INITIALS[c.slug] ?? c.name[0]?.toUpperCase() ?? "?";
          const delayClass = ["delay-1", "delay-2", "delay-3", "delay-4"][i] ?? "";
          const cardColor  = ring === "ring-violet" ? "card-violet" : ring === "ring-pink" ? "card-pink" : "card-cyan";

          return (
            <div
              key={c.id}
              className={`companion-card ${cardColor} anim-fade-up ${delayClass}`}
              onClick={() => openChat(c)}
            >
              {/* Avatar ring */}
              <div
                className={`avatar-ring ${ring}`}
                style={{ width: 54, height: 54 }}
              >
                <div className="avatar-inner">
                  <AvatarInner
                    slug={c.slug}
                    name={c.name}
                    avatarUrl={c.avatar_url}
                    colors={colors}
                    initial={initial}
                  />
                  {/* Online dot */}
                  <div
                    className={`online-dot ${ring === "ring-cyan" ? "dot-violet" : "dot-green"}`}
                  />
                  {/* Locked overlay */}
                  {locked && (
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "rgba(0,0,0,0.65)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: "50%",
                    }}>
                      <span style={{ fontSize: 18 }}>🔒</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card body */}
              <div className="card-body">
                <div className="card-name">{c.name}</div>
                <div className="card-desc">{c.description}</div>
                <div className="card-tags">
                  {c.style === "anime"
                    ? <span className="lm-tag tag-pink">Аниме</span>
                    : <span className="lm-tag tag-violet">Реализм</span>
                  }
                  {c.is_premium === 1 && (
                    <span className="lm-tag tag-amber">Premium</span>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <div className="card-arrow">
                <ChevronRight />
              </div>
            </div>
          );
        })}

        {/* Premium banner */}
        {!limits?.isPremium && (
          <div className="premium-banner anim-fade-up delay-4" onClick={buyPremium} style={{ marginTop: 6 }}>
            <div className="banner-eyebrow">✦ Эксклюзивно</div>
            <div className="banner-title">Разблокируй Premium</div>
            <div className="banner-desc">Безлимитные чаты · HD фото · Все персонажи</div>
            <div className="banner-cta">⭐ 349 / месяц</div>
          </div>
        )}
      </div>

      {/* ── Bottom navigation ── */}
      <nav className="bottom-nav">
        <div className="nav-item active">
          <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span className="nav-label">Главная</span>
        </div>
        <div className="nav-item" onClick={() => tg?.showAlert("Создание персонажей — скоро!")}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          <span className="nav-label">Создать</span>
        </div>
        <div className="nav-item" onClick={() => tg?.showAlert("Избранное — скоро!")}>
          <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span className="nav-label">Избранное</span>
        </div>
        <div className="nav-item" onClick={buyPremium}>
          <svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <span className="nav-label">Магазин</span>
        </div>
      </nav>
    </div>
  );
}

// ──────────────────────────────────────────────
//  Avatar inner (image or gradient fallback)
// ──────────────────────────────────────────────
function AvatarInner({
  slug,
  name,
  avatarUrl,
  colors,
  initial,
}: {
  slug: string;
  name: string;
  avatarUrl?: string;
  colors: [string, string];
  initial: string;
}) {
  const [imgError, setImgError] = useState(false);

  if (avatarUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div style={{
      width: "100%", height: "100%",
      background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ color: "#fff", fontWeight: 700, fontSize: 18, opacity: 0.9 }}>{initial}</span>
    </div>
  );
}

// ──────────────────────────────────────────────
//  Icons
// ──────────────────────────────────────────────
function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ──────────────────────────────────────────────
//  Loading / Error
// ──────────────────────────────────────────────
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

function ErrorScreen({ message }: { message: string }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 48, marginBottom: 12 }}>😔</p>
        <p style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 12 }}>{message}</p>
        <button
          onClick={() => window.location.reload()}
          style={{ color: "var(--violet-light)", fontSize: 14, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
        >
          Попробовать снова
        </button>
      </div>
    </div>
  );
}
