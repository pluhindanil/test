"use client";

import { useState } from "react";
import { Message } from "@/types";
import { AvatarRing } from "@/components/ui/AvatarRing";
import { CHAR_RING_GRAD } from "@/lib/constants/characters";

interface MessageBubbleProps {
  message: Message;
  slug: string;
  charName: string;
  charAvatarUrl?: string | null;
}

export function MessageBubble({ message, slug, charName, charAvatarUrl }: MessageBubbleProps) {
  const isUser  = message.role === "user";
  const [imgLoaded, setImgLoaded] = useState(false);
  const ringGrad = CHAR_RING_GRAD[slug] ?? "linear-gradient(135deg, #8b5cf6, #ec4899)";

  const miniAvatar = (
    <div style={{ width: 30, height: 30, padding: 2, borderRadius: "50%", background: ringGrad, flexShrink: 0 }}>
      <AvatarRing slug={slug} name={charName} avatarUrl={charAvatarUrl} size={26} />
    </div>
  );

  if (message.isLoading) {
    return (
      <div className="msg-enter" style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        {miniAvatar}
        <div className="bubble-ai">
          <div className="typing-dots">
            <span className="typing-dot-l" />
            <span className="typing-dot-l" />
            <span className="typing-dot-l" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="msg-enter"
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        flexDirection: isUser ? "row-reverse" : "row",
      }}
    >
      {!isUser && miniAvatar}

      <div style={{
        maxWidth: "76%",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: isUser ? "flex-end" : "flex-start",
      }}>
        {message.content && (
          <div
            className={isUser ? "bubble-user" : "bubble-ai"}
            style={{ whiteSpace: "pre-wrap" }}
          >
            {message.content}
          </div>
        )}

        {message.imageUrl && (
          <div style={{ width: "100%", borderRadius: 16, overflow: "hidden" }}>
            {!imgLoaded && (
              <div className="shimmer" style={{ width: "100%", height: 200, borderRadius: 16 }} />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.imageUrl}
              alt="Generated"
              style={{ width: "100%", borderRadius: 16, objectFit: "cover", display: imgLoaded ? "block" : "none" }}
              onLoad={() => setImgLoaded(true)}
            />
          </div>
        )}

        {message.imageGenerationFailed && (
          <p style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
            📷 Не удалось сгенерировать фото
          </p>
        )}
      </div>
    </div>
  );
}
