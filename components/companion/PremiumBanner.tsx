"use client";

interface PremiumBannerProps {
  onBuy: () => void;
}

export function PremiumBanner({ onBuy }: PremiumBannerProps) {
  return (
    <div className="premium-banner anim-fade-up delay-4" onClick={onBuy} style={{ marginTop: 6 }}>
      <div className="banner-eyebrow">✦ Эксклюзивно</div>
      <div className="banner-title">Разблокируй Premium</div>
      <div className="banner-desc">
        Безлимитные чаты · HD фото · Все персонажи
      </div>
      <div className="banner-cta">⭐ 349 / месяц</div>
    </div>
  );
}
