"use client";

import { useState } from "react";
import { CHAR_COLORS, CHAR_INITIALS, CHAR_RING_GRAD } from "@/lib/constants/characters";

interface AvatarRingProps {
  slug: string;
  name: string;
  avatarUrl?: string | null;
  size?: number;
  showOnlineDot?: boolean;
  dotColor?: "green" | "violet";
  locked?: boolean;
}

export function AvatarRing({
  slug,
  name,
  avatarUrl,
  size = 54,
  showOnlineDot = false,
  dotColor = "green",
  locked = false,
}: AvatarRingProps) {
  const [imgError, setImgError] = useState(false);
  const ringGrad = CHAR_RING_GRAD[slug] ?? "linear-gradient(135deg, #8b5cf6, #ec4899)";
  const colors   = CHAR_COLORS[slug]    ?? ["#8b5cf6", "#ec4899"];
  const initial  = CHAR_INITIALS[slug]  ?? name[0]?.toUpperCase() ?? "?";

  return (
    <div
      style={{
        width: size, height: size,
        padding: 2.5,
        borderRadius: "50%",
        background: ringGrad,
        flexShrink: 0,
      }}
    >
      <div className="avatar-inner">
        {/* Photo or gradient fallback */}
        {avatarUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: size * 0.34, opacity: 0.9 }}>
              {initial}
            </span>
          </div>
        )}

        {/* Online dot */}
        {showOnlineDot && !locked && (
          <div
            className={`online-dot ${dotColor === "green" ? "dot-green" : "dot-violet"}`}
            style={{ border: "2px solid var(--bg-card)" }}
          />
        )}

        {/* Lock overlay */}
        {locked && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: "50%",
          }}>
            <span style={{ fontSize: size * 0.32 }}>🔒</span>
          </div>
        )}
      </div>
    </div>
  );
}
