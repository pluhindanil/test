"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTelegram } from "@/components/TelegramProvider";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
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
  style: string;
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
    }).finally(() => setLoadingHistory(false));
  }, [isReady, slug]);

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
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Header */}
      <div className="flex-none px-4 py-3 bg-gray-900/80 backdrop-blur border-b border-white/5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-purple-700 flex items-center justify-center text-xl flex-shrink-0">
          {getEmoji(slug)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm truncate">
            {character?.name ?? slug}
          </p>
          <p className="text-[10px] text-gray-500">AI · всегда онлайн</p>
        </div>
        <button
          onClick={clearHistory}
          className="text-gray-600 hover:text-gray-400 transition-colors p-1"
        >
          <TrashIcon />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loadingHistory ? (
          <div className="flex justify-center pt-20">
            <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState characterName={character?.name} />
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
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
      <div className="flex-none px-4 pb-4 pt-2 bg-gray-950 border-t border-white/5">
        {outOfMessages ? (
          <OutOfMessagesBar />
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
              className="flex-1 bg-gray-800 text-white placeholder-gray-500 rounded-2xl px-4 py-3 text-sm resize-none outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 max-h-32"
              style={{ lineHeight: "1.4" }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || isSending}
              className="flex-shrink-0 w-11 h-11 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors active:scale-95"
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
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const [imgLoaded, setImgLoaded] = useState(false);

  if (message.isLoading) {
    return (
      <div className="flex items-end gap-2 msg-enter">
        <div className="w-7 h-7 rounded-full bg-purple-700 flex-shrink-0 flex items-center justify-center text-sm">
          🤖
        </div>
        <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
          <span className="typing-dot w-2 h-2 rounded-full bg-gray-400 inline-block" />
          <span className="typing-dot w-2 h-2 rounded-full bg-gray-400 inline-block" />
          <span className="typing-dot w-2 h-2 rounded-full bg-gray-400 inline-block" />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 msg-enter ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-purple-700 flex-shrink-0 flex items-center justify-center text-sm self-end">
          🤖
        </div>
      )}

      <div className={`max-w-[78%] space-y-2 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {/* Text */}
        {message.content && (
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              isUser
                ? "bg-purple-600 text-white rounded-br-sm"
                : "bg-gray-800 text-gray-100 rounded-bl-sm"
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
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────

function EmptyState({ characterName }: { characterName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-center space-y-2">
      <p className="text-4xl">💬</p>
      <p className="text-gray-400 text-sm">
        Начни диалог с {characterName ?? "персонажем"}
      </p>
      <p className="text-gray-600 text-xs">
        Каждые несколько сообщений — уникальное фото
      </p>
    </div>
  );
}

function LimitBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-purple-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-gray-600">
        <span>Сообщения сегодня</span>
        <span>{used} / {limit}</span>
      </div>
      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function OutOfMessagesBar() {
  return (
    <div className="bg-purple-900/50 border border-purple-500/40 rounded-2xl p-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-white">Лимит исчерпан</p>
        <p className="text-xs text-gray-400">Обновится завтра или оформите Premium</p>
      </div>
      <span className="text-2xl flex-shrink-0">💎</span>
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

function getEmoji(slug: string): string {
  const map: Record<string, string> = { aria: "🎨", yuki: "🌸", sofia: "👔", luna: "🌙" };
  return map[slug] ?? "💜";
}
