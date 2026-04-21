"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTelegram } from "@/components/TelegramProvider";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  imageGenerationFailed?: boolean;
  isLoading?: boolean;
}

interface Limits {
  messages: { used: number; limit: number | null };
  images:   { used: number; limit: number | null };
  isPremium: boolean;
}

interface Character {
  id: number;
  slug: string;
  name: string;
  description: string;
  style: string;
  avatar_url: string;
  is_premium: number;
}

export default function ChatPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { tg, authHeaders, isReady } = useTelegram();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [limits, setLimits] = useState<Limits | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // ── Back button ───────────────────────────────
  useEffect(() => {
    if (!tg) return;
    tg.BackButton.show();
    const back = () => router.push("/");
    tg.BackButton.onClick(back);
    return () => {
      tg.BackButton.offClick(back);
      tg.BackButton.hide();
    };
  }, [tg]);

  // ── Load history + user info ──────────────────
  useEffect(() => {
    if (!isReady || !slug) return;
    setLoadingHistory(true);

    setHistoryError(false);
    Promise.all([
      fetch(`/api/history?characterSlug=${slug}`, { headers: authHeaders }).then(r => r.json()),
      fetch("/api/user", { headers: authHeaders }).then(r => r.json()),
    ]).then(([hist, userData]) => {
      setLimits(userData.limits);
      const chars: Character[] = userData.characters ?? [];
      const found = chars.find(c => c.slug === slug) ?? null;
      setCharacter(found);

      const msgs: Message[] = (hist.history ?? []).map((m: any) => ({
        id: String(m.id),
        role: m.role,
        content: m.content,
        imageUrl: m.image_url ?? undefined,
      }));
      setMessages(msgs);
    }).catch(() => setHistoryError(true))
      .finally(() => setLoadingHistory(false));
  }, [isReady, slug, retryCount]);

  // ── Auto-scroll ───────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ──────────────────────────────
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;

    tg?.HapticFeedback.impactOccurred("light");

    const userMsg: Message = {
      id: Date.now() + "-user",
      role: "user",
      content: text,
    };
    const loadingMsg: Message = {
      id: Date.now() + "-loading",
      role: "assistant",
      content: "",
      isLoading: true,
    };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ characterSlug: slug, message: text }),
      });

      const data = await res.json();

      if (res.status === 429) {
        tg?.showAlert(data.message ?? "Лимит исчерпан. Оформите Premium!");
        tg?.HapticFeedback.notificationOccurred("error");
        setMessages(prev => prev.filter(m => !m.isLoading));
        return;
      }

      if (!res.ok) throw new Error(data.error ?? "Unknown error");

      const aiMsg: Message = {
        id: Date.now() + "-ai",
        role: "assistant",
        content: data.text,
        imageUrl: data.imageUrl,
        imageGenerationFailed: data.imageGenerationFailed,
      };

      setMessages(prev => [...prev.filter(m => !m.isLoading), aiMsg]);
      setLimits(data.limits);
      tg?.HapticFeedback.notificationOccurred("success");

    } catch (e: any) {
      setMessages(prev => prev.filter(m => !m.isLoading));
      tg?.showAlert("Ошибка соединения, попробуй ещё раз");
      tg?.HapticFeedback.notificationOccurred("error");
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [input, isSending, slug, authHeaders, tg]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearHistory = async () => {
    tg?.showConfirm("Очистить историю чата?", async (ok) => {
      if (!ok) return;
      await fetch(`/api/history?characterSlug=${slug}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      setMessages([]);
    });
  };

  const outOfMessages = !limits?.isPremium &&
    limits?.messages.limit != null &&
    (limits.messages.used ?? 0) >= limits.messages.limit;

  // ── Render ────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#05050e]">
      {/* Header */}
      <div className="flex-none px-4 py-3 bg-[#0c0c1d]/90 backdrop-blur-xl border-b border-purple-500/10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 relative">
          <AvatarImage slug={slug} name={character?.name ?? slug} avatarUrl={character?.avatar_url} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm truncate">
            {character?.name ?? slug}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/60 animate-pulse" />
            <p className="text-[10px] text-gray-500">всегда онлайн</p>
          </div>
        </div>
        <button
          onClick={clearHistory}
          className="text-gray-600 hover:text-gray-400 transition-colors p-1"
        >
          <TrashIcon />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#05050e]">
        {loadingHistory ? (
          <div className="flex justify-center pt-20">
            <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin shadow-md shadow-purple-900/40" />
          </div>
        ) : historyError ? (
          <div className="flex flex-col items-center justify-center h-48 text-center space-y-3">
            <p className="text-3xl">😔</p>
            <p className="text-gray-400 text-sm">Не удалось загрузить историю</p>
            <button
              onClick={() => setRetryCount(c => c + 1)}
              className="text-sm text-purple-400 underline"
            >
              Попробовать снова
            </button>
          </div>
        ) : messages.length === 0 ? (
          <EmptyState characterName={character?.name} />
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              charSlug={slug}
              charName={character?.name ?? slug}
              charAvatarUrl={character?.avatar_url}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Limit warning */}
      {!limits?.isPremium && limits?.messages.limit && (
        <div className="flex-none px-4 pb-1">
          <LimitBar
            used={limits.messages.used}
            limit={limits.messages.limit}
          />
        </div>
      )}

      {/* Input area */}
      <div className="flex-none px-4 pb-4 pt-2 bg-[#05050e] border-t border-white/[0.04]">
        {outOfMessages ? (
          <OutOfMessagesBar authHeaders={authHeaders} tg={tg} onPremiumActivated={() =>
            fetch("/api/user", { headers: authHeaders }).then(r => r.json()).then(d => setLimits(d.limits))
          } />
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Написать..."
              disabled={isSending}
              rows={1}
              className="flex-1 bg-[#0c0c1d] text-white placeholder-gray-600 rounded-2xl px-4 py-3 text-sm resize-none border border-white/[0.06] focus:border-purple-500/40 focus:ring-0 focus:outline-none disabled:opacity-50 max-h-32"
              style={{ lineHeight: "1.4" }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || isSending}
              className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-[0.97] shadow-md shadow-purple-900/40"
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <SendIcon />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
//  Message bubble
// ──────────────────────────────────────────────
function MessageBubble({
  message,
  charSlug,
  charName,
  charAvatarUrl,
}: {
  message: Message;
  charSlug: string;
  charName: string;
  charAvatarUrl?: string;
}) {
  const isUser = message.role === "user";
  const [imgLoaded, setImgLoaded] = useState(false);

  if (message.isLoading) {
    return (
      <div className="flex items-end gap-2 msg-enter">
        <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 relative bg-purple-700">
          <AvatarImage slug={charSlug} name={charName} avatarUrl={charAvatarUrl} />
        </div>
        <div className="bg-[#0c0c1d] border border-white/[0.06] rounded-2xl rounded-bl-none px-4 py-3 flex gap-1.5">
          <span className="typing-dot w-2 h-2 rounded-full bg-purple-400 inline-block" />
          <span className="typing-dot w-2 h-2 rounded-full bg-purple-400 inline-block" />
          <span className="typing-dot w-2 h-2 rounded-full bg-purple-400 inline-block" />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 msg-enter ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 relative bg-purple-700 self-end">
          <AvatarImage slug={charSlug} name={charName} avatarUrl={charAvatarUrl} />
        </div>
      )}

      <div className={`max-w-[78%] space-y-2 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {/* Text */}
        {message.content && (
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              isUser
                ? "bg-gradient-to-br from-purple-600 to-violet-700 text-white shadow-md shadow-purple-900/30 rounded-br-none"
                : "bg-[#0c0c1d] border border-white/[0.06] text-gray-100 rounded-bl-none"
            }`}
          >
            {message.content}
          </div>
        )}

        {/* Image */}
        {message.imageUrl && (
          <div className="w-full rounded-2xl overflow-hidden">
            {!imgLoaded && (
              <div className="w-full h-48 shimmer rounded-2xl" />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.imageUrl}
              alt="Generated scene"
              className={`w-full rounded-2xl object-cover transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0 absolute"}`}
              onLoad={() => setImgLoaded(true)}
            />
          </div>
        )}

        {/* Image generation failure notice */}
        {message.imageGenerationFailed && (
          <p className="text-[11px] text-gray-600 italic">📷 Не удалось сгенерировать фото</p>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────

function EmptyState({ characterName }: { characterName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center space-y-3 px-6">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600/20 to-violet-600/20 border border-purple-500/20 flex items-center justify-center text-3xl">
        ✨
      </div>
      <div className="space-y-1">
        <p className="text-white font-medium text-sm">
          {characterName ? `Напиши ${characterName}` : "Начни диалог"}
        </p>
        <p className="text-gray-600 text-xs leading-relaxed">
          Каждые 5 сообщений — уникальное фото
        </p>
      </div>
    </div>
  );
}

function LimitBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min((used / limit) * 100, 100);
  const color =
    pct >= 90
      ? "bg-red-500"
      : pct >= 60
      ? "bg-gradient-to-r from-amber-500 to-orange-500"
      : "bg-gradient-to-r from-purple-600 to-violet-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-gray-600">
        <span>Сообщения сегодня</span>
        <span>{used} / {limit}</span>
      </div>
      <div className="h-1 bg-[#0c0c1d] rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function OutOfMessagesBar({
  authHeaders,
  tg,
  onPremiumActivated,
}: {
  authHeaders: Record<string, string>;
  tg: any;
  onPremiumActivated: () => void;
}) {
  const buy = async () => {
    tg?.HapticFeedback.impactOccurred("medium");
    try {
      const res = await fetch("/api/payment/invoice", { method: "POST", headers: authHeaders });
      const data = await res.json();
      if (!res.ok || !data.invoiceLink) { tg?.showAlert(data.error ?? "Ошибка"); return; }
      tg?.openInvoice(data.invoiceLink, (status: string) => {
        if (status === "paid") {
          tg?.HapticFeedback.notificationOccurred("success");
          onPremiumActivated();
        }
      });
    } catch { tg?.showAlert("Ошибка соединения"); }
  };

  return (
    <div className="bg-[#0c0c1d] border border-purple-500/20 rounded-2xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Лимит исчерпан</p>
          <p className="text-xs text-gray-400">Обновится завтра или оформите Premium</p>
        </div>
        <span className="text-2xl flex-shrink-0">💎</span>
      </div>
      <button
        onClick={buy}
        className="btn-primary w-full py-2.5 rounded-xl font-bold text-sm"
      >
        Купить Premium 199 ⭐
      </button>
    </div>
  );
}

// Icons
const SendIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

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
}: {
  slug: string;
  name: string;
  avatarUrl?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const gradient = AVATAR_GRADIENTS[slug] ?? "from-purple-700 to-violet-500";
  const initial = AVATAR_INITIALS[slug] ?? name[0]?.toUpperCase() ?? "?";

  if (avatarUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className="absolute inset-0 w-full h-full object-cover"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className={`absolute inset-0 bg-gradient-to-b ${gradient} flex items-center justify-center`}>
      <span className="text-white font-bold text-xs opacity-90 select-none">{initial}</span>
    </div>
  );
}
