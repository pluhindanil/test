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
          // Перезагружаем данные пользователя
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

  const freeChars = characters.filter((c) => !c.is_premium);
  const premiumChars = characters.filter((c) => c.is_premium);

  return (
    <div className="min-h-screen bg-[#05050e] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#05050e]/95 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">
              Привет,{" "}
              <span className="text-gradient">{apiUser?.firstName ?? "друг"}</span>
              {" "}👋
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Выбери персонажа</p>
          </div>
          <LimitsBadge limits={limits} />
        </div>
      </div>

      <div className="px-4 pt-5 space-y-6">
        {/* Free characters */}
        <Section title="Персонажи">
          <div className="grid grid-cols-2 gap-3">
            {freeChars.map((c) => (
              <CharacterCard key={c.id} character={c} onSelect={openChat} />
            ))}
          </div>
        </Section>

        {/* Premium characters */}
        {premiumChars.length > 0 && (
          <Section title="Premium 💎" titleClass="text-amber-400">
            <div className="grid grid-cols-2 gap-3">
              {premiumChars.map((c) => (
                <CharacterCard
                  key={c.id}
                  character={c}
                  onSelect={openChat}
                  locked={!limits?.isPremium}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Upgrade banner for free users */}
        {!limits?.isPremium && <UpgradeBanner onBuy={buyPremium} />}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
//  Sub-components
// ──────────────────────────────────────────────

function CharacterCard({
  character,
  onSelect,
  locked = false,
}: {
  character: Character;
  onSelect: (c: Character) => void;
  locked?: boolean;
}) {
  const styleLabel = character.style === "anime" ? "Аниме" : "Реализм";

  return (
    <button
      onClick={() => onSelect(character)}
      className="relative text-left rounded-2xl overflow-hidden bg-[#0c0c1d] border border-purple-500/[0.12] active:scale-[0.97] transition-all duration-150"
    >
      {/* Full-height poster image */}
      <div className="relative w-full aspect-[3/4]">
        <AvatarImage slug={character.slug} name={character.name} avatarUrl={character.avatar_url} />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* Style badge */}
        <div className="absolute top-2 left-2">
          <span className="text-[10px] font-medium bg-black/50 text-gray-300 px-2 py-0.5 rounded-full backdrop-blur-sm">
            {styleLabel}
          </span>
        </div>

        {/* Premium badge */}
        {character.is_premium === 1 && (
          <div className="absolute top-2 right-2">
            <span className="text-[10px] font-bold bg-amber-500 text-black px-2 py-0.5 rounded-full">
              💎
            </span>
          </div>
        )}

        {/* Locked overlay */}
        {locked && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-1">
            <span className="text-3xl">🔒</span>
            <span className="text-[11px] text-white/80 font-medium">Premium</span>
          </div>
        )}

        {/* Name + description overlaid at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="font-semibold text-white text-sm">{character.name}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">
            {character.description}
          </p>
        </div>
      </div>
    </button>
  );
}

function Section({
  title,
  titleClass = "text-white",
  children,
}: {
  title: string;
  titleClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className={`font-semibold text-sm mb-3 ${titleClass}`}>{title}</h2>
      {children}
    </div>
  );
}

function LimitsBadge({ limits }: { limits: Limits | null }) {
  if (!limits) return null;
  if (limits.isPremium) {
    return (
      <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-medium">
        💎 Premium
      </span>
    );
  }
  return (
    <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2.5 py-1 rounded-full">
      ⚡ {limits.messages.used}/{limits.messages.limit}
    </span>
  );
}

function UpgradeBanner({ onBuy }: { onBuy: () => void }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-purple-950/80 to-violet-950/80 border border-purple-500/20 p-4 shadow-lg shadow-purple-900/20">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl flex-shrink-0">
          💎
        </div>
        <div>
          <p className="font-bold text-white text-sm">Premium подписка</p>
          <p className="text-xs text-purple-300/60 mt-0.5">30 дней · 199 Telegram Stars</p>
        </div>
      </div>
      <div className="space-y-1.5 mb-4">
        {[
          "Безлимитные сообщения каждый день",
          "Все персонажи включая эксклюзивных",
          "Больше AI-фото в каждом чате",
        ].map((f) => (
          <div key={f} className="flex items-center gap-2">
            <span className="text-purple-400 text-xs">✦</span>
            <p className="text-xs text-gray-300">{f}</p>
          </div>
        ))}
      </div>
      <button
        onClick={onBuy}
        className="btn-primary w-full py-3 rounded-xl font-bold text-sm"
      >
        Купить 199 ⭐
      </button>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#05050e] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mx-auto shadow-lg shadow-purple-900/40" />
        <p className="text-gray-400 text-sm">Загрузка...</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#05050e] flex items-center justify-center px-6">
      <div className="text-center space-y-3">
        <p className="text-4xl">😔</p>
        <p className="text-white font-medium">{message}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-purple-400 underline"
        >
          Попробовать снова
        </button>
      </div>
    </div>
  );
}

const AVATAR_GRADIENTS: Record<string, string> = {
  aria:  "from-purple-600 via-pink-500 to-rose-400",
  yuki:  "from-pink-500 via-fuchsia-500 to-blue-400",
  sofia: "from-blue-600 via-cyan-500 to-teal-400",
  luna:  "from-indigo-600 via-violet-500 to-purple-400",
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
  className = "absolute inset-0 w-full h-full",
}: {
  slug: string;
  name: string;
  avatarUrl?: string;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const gradient = AVATAR_GRADIENTS[slug] ?? "from-gray-700 to-gray-500";
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
    <div className={`${className} bg-gradient-to-b ${gradient} flex items-center justify-center`}>
      <span className="text-white font-bold text-5xl opacity-80 select-none">{initial}</span>
    </div>
  );
}
