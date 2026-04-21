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

export default function HomePage() {
  const { authHeaders, tg, isReady } = useTelegram();
  const router = useRouter();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [apiUser, setApiUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      const res = await fetch("/api/payment/invoice", {
        method: "POST",
        headers: authHeaders,
      });
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
  if (error) return <ErrorScreen message={error} />;

  const msgUsed  = limits?.messages.used  ?? 0;
  const msgLimit = limits?.messages.limit ?? 20;
  const energyPct = limits?.isPremium ? 100 : Math.min(100, (msgUsed / msgLimit) * 100);

  return (
    <div className="min-h-screen bg-[#0d0d2b] pb-28">

      {/* ── Header ── */}
      <div className="px-4 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white tracking-tight">Lucid Dreams</h1>
          <div className="flex items-center gap-2">
            {/* Diamond counter */}
            <div className="flex items-center gap-1.5 bg-[#1a1a45] rounded-full px-3 py-1.5 border border-blue-500/20">
              <span className="text-blue-400 text-sm">💎</span>
              <span className="text-white text-sm font-semibold">{apiUser?.diamonds ?? 0}</span>
            </div>
            {/* Shop */}
            <button
              onClick={buyPremium}
              className="w-9 h-9 bg-[#5b2fc9] rounded-full flex items-center justify-center active:scale-95 transition-transform"
            >
              🛍
            </button>
            {/* Add character — coming soon */}
            <button
              onClick={() => tg?.showAlert("Создание персонажей — скоро!")}
              className="w-9 h-9 bg-[#5b2fc9] rounded-full flex items-center justify-center text-white text-xl font-bold active:scale-95 transition-transform"
            >
              +
            </button>
          </div>
        </div>

        {/* Energy bar */}
        <div className="mt-5 bg-[#141432] rounded-2xl p-4 border border-white/[0.04]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-gray-400 tracking-widest">ЭНЕРГИЯ</span>
            <span className="text-sm font-bold text-white">
              {limits?.isPremium ? "∞" : `${msgUsed}/${msgLimit}`}
            </span>
          </div>
          <div className="h-2 bg-[#0d0d2b] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${energyPct}%`,
                background: "linear-gradient(90deg, #c026d3, #7c3aed)",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Character list ── */}
      <div className="px-4 space-y-3">
        {characters.length === 0 && (
          <div className="text-center text-gray-500 py-12 text-sm">Загружаем персонажей…</div>
        )}
        {characters.map((c) => (
          <CharacterCard
            key={c.id}
            character={c}
            locked={c.is_premium === 1 && !limits?.isPremium}
            onSelect={openChat}
          />
        ))}
      </div>

      {/* ── Fixed Premium button ── */}
      {!limits?.isPremium && (
        <div className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-[#0d0d2b]/90 backdrop-blur-md">
          <button
            onClick={buyPremium}
            className="w-full py-4 rounded-2xl font-bold text-black text-base active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(90deg, #f59e0b, #f97316)" }}
          >
            ⭐ Premium 349 ⭐/мес
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
//  CharacterCard — горизонтальная карточка
// ──────────────────────────────────────────────
function CharacterCard({
  character,
  locked,
  onSelect,
}: {
  character: Character;
  locked: boolean;
  onSelect: (c: Character) => void;
}) {
  const styleLabel = character.style === "anime" ? "✨ Аниме" : "🎮 Реализтик";

  return (
    <button
      onClick={() => onSelect(character)}
      className="w-full flex items-center gap-4 p-3 bg-[#141432] rounded-2xl border border-white/[0.05] text-left active:scale-[0.98] transition-all duration-150"
    >
      {/* Circle avatar */}
      <div className="w-[64px] h-[64px] rounded-full overflow-hidden flex-shrink-0 relative">
        <AvatarImage
          slug={character.slug}
          name={character.name}
          avatarUrl={character.avatar_url}
          className="w-full h-full"
        />
        {locked && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full">
            <span className="text-lg">🔒</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-white text-[15px]">{character.name}</p>
        <p className="text-gray-400 text-[13px] mt-0.5 truncate">{character.description}</p>
        <div className="mt-2">
          <span className="text-[11px] bg-[#1e1e50] text-gray-300 px-2.5 py-0.5 rounded-full border border-white/[0.06]">
            {styleLabel}
          </span>
        </div>
      </div>

      {/* Right sparkle */}
      <div className="flex-shrink-0 text-purple-400 text-xl pr-1">
        {locked ? "💎" : "✨"}
      </div>
    </button>
  );
}

// ──────────────────────────────────────────────
//  Avatar with gradient fallback
// ──────────────────────────────────────────────
const AVATAR_GRADIENTS: Record<string, string[]> = {
  aria:  ["#9333ea", "#ec4899"],
  yuki:  ["#ec4899", "#3b82f6"],
  sofia: ["#2563eb", "#06b6d4"],
  luna:  ["#4f46e5", "#7c3aed"],
};

const AVATAR_INITIALS: Record<string, string> = {
  aria:  "A",
  yuki:  "ユ",
  sofia: "С",
  luna:  "Л",
};

function AvatarImage({
  slug,
  name,
  avatarUrl,
  className = "w-full h-full",
}: {
  slug: string;
  name: string;
  avatarUrl?: string;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const colors = AVATAR_GRADIENTS[slug] ?? ["#374151", "#6b7280"];
  const initial = AVATAR_INITIALS[slug] ?? name[0]?.toUpperCase() ?? "?";

  if (avatarUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={`${className} object-cover`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center`}
      style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
    >
      <span className="text-white font-bold text-2xl opacity-90 select-none">{initial}</span>
    </div>
  );
}

// ──────────────────────────────────────────────
//  Loading / Error screens
// ──────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0d0d2b] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mx-auto" />
        <p className="text-gray-400 text-sm">Загрузка...</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#0d0d2b] flex items-center justify-center px-6">
      <div className="text-center space-y-3">
        <p className="text-4xl">😔</p>
        <p className="text-white font-medium">{message}</p>
        <button onClick={() => window.location.reload()} className="text-sm text-purple-400 underline">
          Попробовать снова
        </button>
      </div>
    </div>
  );
}
