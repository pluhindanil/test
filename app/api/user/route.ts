/**
 * GET /api/user — возвращает данные пользователя + лимиты + персонажи
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequestSafe } from "@/lib/telegram";
import { upsertUser, resetDailyCountsIfNeeded, getLimits, getAllCharacters, initDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let dbInitialized = false;

export async function GET(req: NextRequest) {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }

  let parsed;
  try {
    parsed = getUserFromRequestSafe(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user: tgUser } = parsed;
  let dbUser = await upsertUser(String(tgUser.id), tgUser.username, tgUser.first_name);
  dbUser = await resetDailyCountsIfNeeded(dbUser);

  return NextResponse.json({
    user: {
      id: dbUser.id,
      telegramId: dbUser.telegram_id,
      username: dbUser.username,
      firstName: dbUser.first_name,
      diamonds: dbUser.diamonds ?? 0,
    },
    limits: getLimits(dbUser),
    characters: await getAllCharacters(),
  });
}
