"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTelegram } from "@/components/TelegramProvider";
import { BottomNav } from "@/components/layout/BottomNav";

type Style = "realistic" | "anime" | "fantasy";

const STYLE_OPTS: { id: Style; emoji: string; label: string }[] = [
  { id: "realistic", emoji: "🎨", label: "Реализм" },
  { id: "anime",     emoji: "🌸", label: "Аниме" },
  { id: "fantasy",   emoji: "🌟", label: "Фэнтези" },
];

export default function CreatePage() {
  const { tg } = useTelegram();
  const router = useRouter();

  const [name,      setName]      = useState("");
  const [persona,   setPersona]   = useState("");
  const [style,     setStyle]     = useState<Style>("realistic");
  const [creating,  setCreating]  = useState(false);

  const handleCreate = () => {
    if (!name.trim()) { tg?.showAlert("Введите имя персонажа"); return; }
    tg?.HapticFeedback.impactOccurred("medium");
    tg?.showAlert("Создание персонажей — скоро!\n\nЭта функция появится в следующем обновлении.");
  };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 88, position: "relative" }}>
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />

      {/* Header */}
      <div style={{
        padding: "max(52px, calc(env(safe-area-inset-top) + 12px)) 20px 20px",
        display: "flex", alignItems: "center", gap: 12,
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(13,11,26,0.88)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      }}>
        <button className="back-btn" onClick={() => router.push("/")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800 }}>
            Создать{" "}
            <span style={{ background: "var(--grad-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              компаньона
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Photo upload */}
        <div style={{
          height: 120, border: "1.5px dashed rgba(139,92,246,0.4)", borderRadius: 18,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
          background: "var(--bg-surface)", cursor: "pointer", color: "var(--text-muted)", fontSize: 13,
        }}
          onClick={() => tg?.showAlert("Загрузка фото — скоро!")}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>Загрузить фото</span>
        </div>

        {/* Name */}
        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>Имя</div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Как её зовут?"
            style={{
              width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: 12, padding: "12px 16px", fontSize: 14, color: "var(--text-primary)",
              fontFamily: "var(--font-body)", outline: "none",
            }}
            onFocus={e => e.target.style.borderColor = "var(--violet)"}
            onBlur={e => e.target.style.borderColor = "var(--border)"}
          />
        </div>

        {/* Personality */}
        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>Характер</div>
          <textarea
            value={persona}
            onChange={e => setPersona(e.target.value)}
            placeholder="Опиши характер, интересы, манеру общения..."
            rows={4}
            style={{
              width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: 12, padding: "12px 16px", fontSize: 14, color: "var(--text-primary)",
              fontFamily: "var(--font-body)", outline: "none", resize: "none", lineHeight: 1.5,
            }}
            onFocus={e => e.target.style.borderColor = "var(--violet)"}
            onBlur={e => e.target.style.borderColor = "var(--border)"}
          />
        </div>

        {/* Style picker */}
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>Стиль</div>
          <div style={{ display: "flex", gap: 10 }}>
            {STYLE_OPTS.map(opt => (
              <div
                key={opt.id}
                onClick={() => setStyle(opt.id)}
                style={{
                  flex: 1, padding: "12px 8px", borderRadius: 12, textAlign: "center", cursor: "pointer",
                  border: `1.5px solid ${style === opt.id ? "var(--violet)" : "var(--border)"}`,
                  background: style === opt.id ? "rgba(139,92,246,0.12)" : "var(--bg-surface)",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 5 }}>{opt.emoji}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: style === opt.id ? "var(--violet-light)" : "var(--text-secondary)" }}>
                  {opt.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create button */}
        <button
          className="btn-primary-lumina"
          onClick={handleCreate}
          disabled={creating}
          style={{ padding: "14px 0", fontSize: 16, width: "100%", letterSpacing: 0.3 }}
        >
          {creating ? "Создаём..." : "Создать ✦"}
        </button>

        {/* Coming soon note */}
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: -8, lineHeight: 1.5 }}>
          Создание персонажей появится в следующем обновлении
        </p>
      </div>

      <BottomNav active="create" onFavoritesClick={() => tg?.showAlert("Избранное — скоро!")} onShopClick={() => router.push("/shop")} />
    </div>
  );
}
