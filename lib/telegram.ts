/**
 * Telegram WebApp initData validation (HMAC-SHA256)
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
import { createHmac } from "crypto";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface ParsedInitData {
  user: TelegramUser;
  auth_date: number;
  hash: string;
  query_id?: string;
  chat_type?: string;
}

/**
 * Validates Telegram initData on the server.
 * Returns parsed data if valid, throws if tampered.
 */
export function validateInitData(initData: string): ParsedInitData {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) throw new Error("BOT_TOKEN not set");

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("Missing hash");

  params.delete("hash");

  // Build check string: sorted key=value pairs joined by \n
  const checkString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  // HMAC-SHA256(checkString, HMAC-SHA256("WebAppData", botToken))
  const secretKey = createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();

  const expectedHash = createHmac("sha256", secretKey)
    .update(checkString)
    .digest("hex");

  if (expectedHash !== hash) {
    throw new Error("Invalid initData signature");
  }

  // Optionally check freshness (5 minutes)
  const authDate = parseInt(params.get("auth_date") ?? "0", 10);
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age > 300) {
    throw new Error("initData expired");
  }

  const userRaw = params.get("user");
  if (!userRaw) throw new Error("No user in initData");

  return {
    user: JSON.parse(userRaw) as TelegramUser,
    auth_date: authDate,
    hash,
    query_id: params.get("query_id") ?? undefined,
    chat_type: params.get("chat_type") ?? undefined,
  };
}

/**
 * Extracts user from initData header sent by frontend.
 * Use in API routes.
 */
export function getUserFromRequest(request: Request): ParsedInitData {
  const initData = request.headers.get("x-telegram-init-data");
  if (!initData) throw new Error("Missing x-telegram-init-data header");
  return validateInitData(initData);
}

/**
 * Development bypass — returns mock user when BOT_ENV=dev
 */
export function getUserFromRequestSafe(request: Request): ParsedInitData {
  if (process.env.BOT_ENV === "dev") {
    return {
      user: {
        id: 123456789,
        first_name: "Dev",
        username: "devuser",
        is_premium: true,
      },
      auth_date: Math.floor(Date.now() / 1000),
      hash: "devhash",
    };
  }
  return getUserFromRequest(request);
}
