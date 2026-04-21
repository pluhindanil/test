export interface Character {
  id: number;
  slug: string;
  name: string;
  description: string;
  personality: string;
  style: "realistic" | "anime";
  avatar_url: string | null;
  is_premium: number;
}

export interface DBUser {
  id: number;
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  is_premium: number;
  subscription_until: string | null;
  messages_today: number;
  images_today: number;
  last_reset_date: string;
  diamonds: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  imageGenerationFailed?: boolean;
  isLoading?: boolean;
}

export interface Limits {
  messages: { used: number; limit: number | null };
  images:   { used: number; limit: number | null };
  isPremium: boolean;
}

export interface ApiUser {
  id: number;
  telegramId: string;
  firstName: string | null;
  username: string | null;
  diamonds: number;
}
