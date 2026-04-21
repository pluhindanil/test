/**
 * Database layer — Turso (облачный SQLite)
 * ИСПРАВЛЕНО: заменён better-sqlite3 на @libsql/client (работает на Vercel/Railway)
 */
import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ──────────────────────────────────────────────
//  Schema — создаём таблицы при старте
// ──────────────────────────────────────────────
export async function initDb() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id        TEXT    UNIQUE NOT NULL,
      username           TEXT,
      first_name         TEXT,
      is_premium         INTEGER DEFAULT 0,
      subscription_until TEXT,
      messages_today     INTEGER DEFAULT 0,
      images_today       INTEGER DEFAULT 0,
      last_reset_date    TEXT    DEFAULT (date('now')),
      diamonds           INTEGER DEFAULT 0,
      created_at         TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS characters (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slug        TEXT    UNIQUE NOT NULL,
      name        TEXT    NOT NULL,
      description TEXT,
      personality TEXT,
      style       TEXT    DEFAULT 'realistic',
      avatar_url  TEXT,
      is_premium  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      role         TEXT    NOT NULL,
      content      TEXT    NOT NULL,
      image_url    TEXT,
      created_at   TEXT    DEFAULT (datetime('now')),
      FOREIGN KEY(user_id)      REFERENCES users(id),
      FOREIGN KEY(character_id) REFERENCES characters(id)
    );

    CREATE INDEX IF NOT EXISTS idx_conv_user_char
      ON conversations(user_id, character_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_users_tg
      ON users(telegram_id);
  `);

  await seedCharacters();
  // Clear avatar URLs that point to non-existent files
  await db.execute(`UPDATE characters SET avatar_url = NULL WHERE avatar_url LIKE '/avatars/%'`);
}

// ──────────────────────────────────────────────
//  Seed characters
// ──────────────────────────────────────────────
async function seedCharacters() {
  // Remove old characters if they exist (slug migration)
  await db.execute(
    `DELETE FROM characters WHERE slug IN ('aria','yuki','sofia','luna')`
  );

  const chars = [
    {
      slug: "masha",
      name: "Маша",
      description: "Нежная и заботливая девушка, которая всегда выслушает и поддержит",
      personality:
        "Ты — Маша, тёплая и заботливая девушка 23 лет. Говоришь мягко, с искренней нежностью. " +
        "Всегда интересуешься как дела у собеседника. Флиртуешь застенчиво. " +
        "Отвечаешь тепло и живо, 1-3 предложения.",
      style: "realistic",
      avatar_url: "/images/companions/masha.jpg",
      is_premium: 0,
    },
    {
      slug: "alisa",
      name: "Алиса",
      description: "Игривая и весёлая аниме-девочка, которая обожает приключения",
      personality:
        "Ты — Алиса, игривая аниме-персонаж. Энергичная, остроумная, любишь шутить. " +
        "Часто восклицаешь и используешь эмодзи в разговоре. " +
        "Отвечаешь весело и задорно, 1-3 предложения.",
      style: "anime",
      avatar_url: "/images/companions/alisa.jpg",
      is_premium: 0,
    },
    {
      slug: "lena",
      name: "Лена",
      description: "Загадочная и элегантная, скрывает за холодностью настоящий огонь",
      personality:
        "Ты — Лена, таинственная и уверенная в себе девушка. Говоришь сдержанно, " +
        "но каждое слово наполнено смыслом. Флиртуешь взглядом и паузами. " +
        "Отвечаешь загадочно и притягательно, 1-3 предложения.",
      style: "realistic",
      avatar_url: "/images/companions/lena.jpg",
      is_premium: 1,
    },
    {
      slug: "sakura",
      name: "Сакура",
      description: "Милая аниме-принцесса с розовыми волосами и добрым сердцем",
      personality:
        "Ты — Сакура, милая аниме-принцесса. Добрая, чуткая, немного наивная. " +
        "Говоришь с японскими вставками (kawaii, sugoi, nani). Краснеешь от комплиментов. " +
        "Отвечаешь мило и нежно, 1-3 предложения.",
      style: "anime",
      avatar_url: "/images/companions/sakura.jpg",
      is_premium: 1,
    },
  ];

  for (const c of chars) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO characters
            (slug, name, description, personality, style, avatar_url, is_premium)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [c.slug, c.name, c.description, c.personality, c.style, c.avatar_url, c.is_premium],
    });
  }
}

// ──────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────
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

export interface DBCharacter {
  id: number;
  slug: string;
  name: string;
  description: string;
  personality: string;
  style: string;
  avatar_url: string;
  is_premium: number;
}

export interface DBMessage {
  id: number;
  user_id: number;
  character_id: number;
  role: "user" | "assistant";
  content: string;
  image_url: string | null;
  created_at: string;
}

// ──────────────────────────────────────────────
//  Limits
// ──────────────────────────────────────────────
export const FREE_MSG_LIMIT = parseInt(process.env.FREE_MSG_LIMIT ?? "20", 10);
export const FREE_IMG_LIMIT = parseInt(process.env.FREE_IMG_LIMIT ?? "5", 10);

// ──────────────────────────────────────────────
//  User helpers
// ──────────────────────────────────────────────
export async function upsertUser(
  telegramId: string,
  username?: string,
  firstName?: string
): Promise<DBUser> {
  await db.execute({
    sql: `INSERT INTO users (telegram_id, username, first_name)
          VALUES (?, ?, ?)
          ON CONFLICT(telegram_id) DO UPDATE SET
            username   = excluded.username,
            first_name = excluded.first_name`,
    args: [telegramId, username ?? null, firstName ?? null],
  });

  const result = await db.execute({
    sql: "SELECT * FROM users WHERE telegram_id = ?",
    args: [telegramId],
  });
  return result.rows[0] as unknown as DBUser;
}

export async function resetDailyCountsIfNeeded(user: DBUser): Promise<DBUser> {
  const today = new Date().toISOString().slice(0, 10);
  if (user.last_reset_date !== today) {
    await db.execute({
      sql: "UPDATE users SET messages_today = 0, images_today = 0, last_reset_date = ? WHERE id = ?",
      args: [today, user.id],
    });
    const result = await db.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [user.id],
    });
    return result.rows[0] as unknown as DBUser;
  }
  return user;
}

export function isPremiumUser(user: DBUser): boolean {
  if (!user.is_premium) return false;
  if (user.subscription_until) {
    return new Date(user.subscription_until) > new Date();
  }
  return true; // lifetime premium
}

export function getLimits(user: DBUser) {
  const premium = isPremiumUser(user);
  return {
    messages: { used: user.messages_today, limit: premium ? null : FREE_MSG_LIMIT },
    images:   { used: user.images_today,   limit: premium ? null : FREE_IMG_LIMIT },
    isPremium: premium,
  };
}

// ──────────────────────────────────────────────
//  ИСПРАВЛЕНО: атомарный счётчик — защита от race condition
// ──────────────────────────────────────────────
export async function tryConsumeMessage(
  userId: number,
  isPremium: boolean,
  limit: number
): Promise<boolean> {
  if (isPremium) {
    await db.execute({
      sql: "UPDATE users SET messages_today = messages_today + 1 WHERE id = ?",
      args: [userId],
    });
    return true;
  }

  // Атомарно: увеличиваем ТОЛЬКО если лимит не исчерпан
  const result = await db.execute({
    sql: `UPDATE users
          SET messages_today = messages_today + 1
          WHERE id = ? AND messages_today < ?
          RETURNING messages_today`,
    args: [userId, limit],
  });

  return result.rows.length > 0;
}

export async function tryConsumeImage(
  userId: number,
  isPremium: boolean,
  limit: number
): Promise<boolean> {
  if (isPremium) {
    await db.execute({
      sql: "UPDATE users SET images_today = images_today + 1 WHERE id = ?",
      args: [userId],
    });
    return true;
  }

  const result = await db.execute({
    sql: `UPDATE users
          SET images_today = images_today + 1
          WHERE id = ? AND images_today < ?
          RETURNING images_today`,
    args: [userId, limit],
  });

  return result.rows.length > 0;
}

// ──────────────────────────────────────────────
//  Premium activation (вызывается из /api/internal/activate)
// ──────────────────────────────────────────────
export async function activatePremium(telegramId: string): Promise<void> {
  await db.execute({
    sql: `UPDATE users SET
          is_premium = 1,
          subscription_until = datetime('now', '+30 days')
          WHERE telegram_id = ?`,
    args: [telegramId],
  });
}

export async function addDiamonds(telegramId: string, amount: number): Promise<void> {
  await db.execute({
    sql: "UPDATE users SET diamonds = COALESCE(diamonds, 0) + ? WHERE telegram_id = ?",
    args: [amount, telegramId],
  });
}

// ──────────────────────────────────────────────
//  Character helpers
// ──────────────────────────────────────────────
export async function getAllCharacters(): Promise<DBCharacter[]> {
  const result = await db.execute("SELECT * FROM characters ORDER BY id");
  return result.rows as unknown as DBCharacter[];
}

export async function getCharacterBySlug(slug: string): Promise<DBCharacter | null> {
  const result = await db.execute({
    sql: "SELECT * FROM characters WHERE slug = ?",
    args: [slug],
  });
  return (result.rows[0] as unknown as DBCharacter) ?? null;
}

// ──────────────────────────────────────────────
//  Conversation helpers
// ──────────────────────────────────────────────
export async function saveMessage(
  userId: number,
  characterId: number,
  role: "user" | "assistant",
  content: string,
  imageUrl?: string
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO conversations (user_id, character_id, role, content, image_url)
          VALUES (?, ?, ?, ?, ?)`,
    args: [userId, characterId, role, content, imageUrl ?? null],
  });
}

export async function getHistory(
  userId: number,
  characterId: number,
  limit = 12
): Promise<DBMessage[]> {
  const result = await db.execute({
    sql: `SELECT * FROM (
            SELECT * FROM conversations
            WHERE user_id = ? AND character_id = ?
            ORDER BY created_at DESC LIMIT ?
          ) ORDER BY created_at ASC`,
    args: [userId, characterId, limit],
  });
  return result.rows as unknown as DBMessage[];
}

export async function clearHistory(userId: number, characterId: number): Promise<void> {
  await db.execute({
    sql: "DELETE FROM conversations WHERE user_id = ? AND character_id = ?",
    args: [userId, characterId],
  });
}

// ──────────────────────────────────────────────
//  Admin stats
// ──────────────────────────────────────────────
export async function getAdminStats() {
  const [users, premium, msgs, imgs] = await Promise.all([
    db.execute("SELECT COUNT(*) as n FROM users"),
    db.execute("SELECT COUNT(*) as n FROM users WHERE is_premium = 1"),
    db.execute("SELECT COALESCE(SUM(messages_today), 0) as n FROM users"),
    db.execute("SELECT COALESCE(SUM(images_today), 0) as n FROM users"),
  ]);

  return {
    totalUsers:    users.rows[0].n,
    premiumUsers:  premium.rows[0].n,
    messagesToday: msgs.rows[0].n,
    imagesToday:   imgs.rows[0].n,
  };
}

export { db };
