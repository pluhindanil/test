"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTelegram } from "@/components/TelegramProvider";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { AvatarRing } from "@/components/ui/AvatarRing";
import { CHAR_RING_GRAD } from "@/lib/constants/characters";
import { Message, Limits, Character } from "@/types";

export default function ChatPage() {
  const { slug } = useParams<{ slug: string }>();
  const router   = useRouter();
  const { tg, authHeaders, isReady } = useTelegram();

  const [messages,       setMessages]       = useState<Message[]>([]);
  const [input,          setInput]          = useState("");
  const [limits,         setLimits]         = useState<Limits | null>(null);
  const [character,      setCharacter]      = useState<Character | null>(null);
  const [isSending,      setIsSending]      = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError,   setHistoryError]   = useState(false);
  const [retryCount,     setRetryCount]     = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Telegram back button + expand to full screen + viewport tracking
  useEffect(() => {
    if (!tg) return;
    tg.BackButton.show();
    tg.expand(); // ensure full screen on iPhone
    const back = () => router.push("/");
    tg.BackButton.onClick(back);
    // Track viewport height changes (keyboard open/close on iOS)
    const tgAny = tg as any;
    const onViewportChanged = () => {
      document.documentElement.style.setProperty(
        "--tg-viewport-height",
        `${tg.viewportHeight}px`
      );
    };
    tgAny.onEvent?.("viewportChanged", onViewportChanged);
    onViewportChanged();
    return () => {
      tg.BackButton.offClick(back);
      tg.BackButton.hide();
      tgAny.offEvent?.("viewportChanged", onViewportChanged);
    };
  }, [tg, router]);

  // Load history & character info
  useEffect(() => {
    if (!isReady || !slug) return;
    setLoadingHistory(true);
    setHistoryError(false);
    Promise.all([
      fetch(`/api/history?characterSlug=${slug}`, { headers: authHeaders }).then(r => r.json()),
      fetch("/api/user", { headers: authHeaders }).then(r => r.json()),
    ]).then(([hist, userData]) => {
      setLimits(userData.limits);
      setCharacter((userData.characters ?? []).find((c: Character) => c.slug === slug) ?? null);
      setMessages((hist.history ?? []).map((m: any) => ({
        id: String(m.id), role: m.role, content: m.content, imageUrl: m.image_url ?? undefined,
      })));
    }).catch(() => setHistoryError(true))
      .finally(() => setLoadingHistory(false));
  }, [isReady, slug, retryCount]);

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Send message
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;
    tg?.HapticFeedback.impactOccurred("light");

    setMessages(prev => [
      ...prev,
      { id: Date.now() + "-u", role: "user",      content: text },
      { id: Date.now() + "-l", role: "assistant",  content: "", isLoading: true },
    ]);
    setInput("");
    setIsSending(true);

    try {
      const res  = await fetch("/api/chat", {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ characterSlug: slug, message: text }),
      });
      const data = await res.json();

      if (res.status === 429) {
        tg?.showAlert(data.message ?? "Лимит исчерпан. Оформите Premium!");
        tg?.HapticFeedback.notificationOccurred("error");
        setMessages(prev => prev.filter(m => !m.isLoading));
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Unknown");

      setMessages(prev => [
        ...prev.filter(m => !m.isLoading),
        { id: Date.now() + "-ai", role: "assistant", content: data.text, imageUrl: data.imageUrl, imageGenerationFailed: data.imageGenerationFailed },
      ]);
      setLimits(data.limits);
      tg?.HapticFeedback.notificationOccurred("success");
    } catch {
      setMessages(prev => prev.filter(m => !m.isLoading));
      tg?.showAlert("Ошибка соединения, попробуй ещё раз");
      tg?.HapticFeedback.notificationOccurred("error");
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [input, isSending, slug, authHeaders, tg]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearHistory = () => {
    tg?.showConfirm("Очистить историю чата?", async (ok) => {
      if (!ok) return;
      await fetch(`/api/history?characterSlug=${slug}`, { method: "DELETE", headers: authHeaders });
      setMessages([]);
    });
  };

  const outOfMessages = !limits?.isPremium
    && limits?.messages.limit != null
    && (limits.messages.used ?? 0) >= limits.messages.limit;

  const charName = character?.name ?? slug;
  const ringGrad = CHAR_RING_GRAD[slug] ?? "linear-gradient(135deg, #8b5cf6, #ec4899)";

  return (
    <div className="chat-screen">

      {/* Header */}
      <div className="chat-header">
        <button className="back-btn" onClick={() => router.push("/")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>

        <div style={{ width: 40, height: 40, padding: 2, borderRadius: "50%", background: ringGrad, flexShrink: 0 }}>
          <AvatarRing slug={slug} name={charName} avatarUrl={character?.avatar_url} size={36} showOnlineDot />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
            {charName}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px #22c55e", display: "inline-block" }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>всегда онлайн</span>
          </div>
        </div>

        <button className="btn-icon-lumina" onClick={clearHistory}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {loadingHistory ? (
          <Spinner />
        ) : historyError ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 12, textAlign: "center" }}>
            <p style={{ fontSize: 40 }}>😔</p>
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Не удалось загрузить историю</p>
            <button onClick={() => setRetryCount(c => c + 1)} style={{ color: "var(--violet-light)", fontSize: 13, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              Попробовать снова
            </button>
          </div>
        ) : messages.length === 0 ? (
          <EmptyState characterName={charName} />
        ) : (
          messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} slug={slug} charName={charName} charAvatarUrl={character?.avatar_url} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Limit progress */}
      {!limits?.isPremium && limits?.messages.limit && (
        <div style={{ padding: "4px 16px 0", flexShrink: 0 }}>
          <LimitBar used={limits.messages.used} limit={limits.messages.limit} />
        </div>
      )}

      {/* Input */}
      <div className="chat-input-wrap">
        {outOfMessages ? (
          <OutOfMessagesBar authHeaders={authHeaders} tg={tg} onSuccess={() =>
            fetch("/api/user", { headers: authHeaders }).then(r => r.json()).then(d => setLimits(d.limits))
          } />
        ) : (
          <>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Написать..."
              disabled={isSending}
              rows={1}
              className="chat-input-lumina"
            />
            <button className="btn-send-lumina" onClick={send} disabled={!input.trim() || isSending}>
              {isSending
                ? <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} />
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              }
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function EmptyState({ characterName }: { characterName: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 260, gap: 12, textAlign: "center", padding: "0 24px" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>✨</div>
      <div>
        <p style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>
          Напиши {characterName}
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
          Каждые 5 сообщений — уникальное AI-фото
        </p>
      </div>
    </div>
  );
}

function LimitBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min((used / limit) * 100, 100);
  const fill = pct >= 90 ? "#ef4444" : pct >= 65 ? "linear-gradient(90deg,#f59e0b,#f97316)" : "var(--grad-primary)";
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>
        <span>Сообщения сегодня</span><span>{used} / {limit}</span>
      </div>
      <div style={{ height: 3, background: "var(--bg-surface)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: fill, borderRadius: 999, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

function OutOfMessagesBar({ authHeaders, tg, onSuccess }: { authHeaders: Record<string, string>; tg: any; onSuccess: () => void }) {
  const buy = async () => {
    tg?.HapticFeedback.impactOccurred("medium");
    try {
      const res  = await fetch("/api/payment/invoice", { method: "POST", headers: authHeaders });
      const data = await res.json();
      if (!res.ok || !data.invoiceLink) { tg?.showAlert(data.error ?? "Ошибка"); return; }
      tg?.openInvoice(data.invoiceLink, (status: string) => {
        if (status === "paid") { tg?.HapticFeedback.notificationOccurred("success"); onSuccess(); }
      });
    } catch { tg?.showAlert("Ошибка соединения"); }
  };
  return (
    <div style={{ width: "100%", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>Лимит исчерпан</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 2 }}>Обновится завтра или оформите Premium</p>
        </div>
        <span style={{ fontSize: 24 }}>💎</span>
      </div>
      <button className="btn-gold-lumina" onClick={buy} style={{ padding: "12px 0", fontSize: 14, width: "100%" }}>
        ⭐ Premium 199 ⭐
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid var(--violet)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}
