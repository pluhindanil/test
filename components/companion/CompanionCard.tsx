"use client";

import { Character } from "@/types";
import { AvatarRing } from "@/components/ui/AvatarRing";
import { Tag } from "@/components/ui/Tag";
import { CARD_COLOR } from "@/lib/constants/characters";

interface CompanionCardProps {
  character: Character;
  locked: boolean;
  delayIndex?: number;
  onSelect: (c: Character) => void;
}

export function CompanionCard({ character, locked, delayIndex = 0, onSelect }: CompanionCardProps) {
  const cardColor = CARD_COLOR[character.slug] ?? "card-violet";
  const delay = ["delay-1", "delay-2", "delay-3", "delay-4"][delayIndex] ?? "";

  return (
    <div
      className={`companion-card ${cardColor} anim-fade-up ${delay}`}
      onClick={() => onSelect(character)}
    >
      <AvatarRing
        slug={character.slug}
        name={character.name}
        avatarUrl={character.avatar_url}
        size={54}
        showOnlineDot
        locked={locked}
      />

      <div className="card-body">
        <div className="card-name">{character.name}</div>
        <div className="card-desc">{character.description}</div>
        <div className="card-tags">
          {character.style === "anime"
            ? <Tag variant="pink">Аниме</Tag>
            : <Tag variant="violet">Реализм</Tag>
          }
          {character.is_premium === 1 && <Tag variant="amber">Premium</Tag>}
        </div>
      </div>

      <div className="card-arrow">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>
  );
}
