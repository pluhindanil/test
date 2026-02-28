"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
      tg?.showAlert("Этот персонаж доступен только Premium подписчикам 💎");
      return;
    }
    tg?.HapticFeedback.selectionChanged();
    router.push(`/chat/${char.slug}`);
  };

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;

  const freeChars = characters.filter((c) => !c.is_premium);
  const premiumChars = characters.filter((c) => c.is_premium);

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md px-4 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">
              Привет, {apiUser?.firstName ?? "друг"} 👋
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Выбери персонажа</p>
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
        {!limits?.isPremium && <UpgradeBanner />}
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
      className="relative text-left rounded-2xl overflow-hidden bg-gray-900 border border-white/5 active:scale-95 transition-transform"
    >
      {/* Avatar */}
      <div className="relative w-full aspect-[3/4] bg-gray-800">
        <div className="absolute inset-0 flex items-center justify-center text-5xl">
          {getEmoji(character.slug)}
        </div>
        {locked && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-3xl">🔒</span>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className="text-[10px] font-medium bg-black/50 text-gray-300 px-2 py-0.5 rounded-full">
            {styleLabel}
          </span>
        </div>
        {character.is_premium === 1 && (
          <div className="absolute top-2 right-2">
            <span className="text-[10px] font-bold bg-amber-500 text-black px-2 py-0.5 rounded-full">
              💎
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="font-semibold text-white text-sm">{character.name}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">
          {character.description}
        </p>
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
      <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full font-medium">
        💎 Premium
      </span>
    );
  }
  return (
    <span className="text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2.5 py-1 rounded-full">
      ⚡ {limits.messages.used}/{limits.messages.limit}
    </span>
  );
}

function UpgradeBanner() {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-purple-900/50 to-violet-900/50 border border-purple-500/30 p-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl">💎</span>
        <div>
          <p className="font-semibold text-white text-sm">Premium подписка</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Безлимитное общение · Все персонажи · Больше фото
          </p>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mx-auto" />
        <p className="text-gray-500 text-sm">Загрузка...</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
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

// Emoji placeholders for avatars (replace with real images)
function getEmoji(slug: string): string {
  const map: Record<string, string> = {
    aria:  "🎨",
    yuki:  "🌸",
    sofia: "👔",
    luna:  "🌙",
  };
  return map[slug] ?? "👤";
}
