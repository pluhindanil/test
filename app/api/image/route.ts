/**
 * POST /api/image — генерация изображения
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequestSafe } from "@/lib/telegram";
import { upsertUser, resetDailyCountsIfNeeded, tryConsumeImage, getLimits, FREE_IMG_LIMIT, initDb } from "@/lib/db";
import { generateImage } from "@/lib/ai";

export const runtime = "nodejs";

let dbInitialized = false;

export async function POST(req: NextRequest) {
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

  let body: { prompt: string; style?: "realistic" | "anime" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  let dbUser = await upsertUser(String(tgUser.id));
  dbUser = await resetDailyCountsIfNeeded(dbUser);
  const limits = getLimits(dbUser);

  // Атомарно проверяем и списываем лимит
  const allowed = await tryConsumeImage(dbUser.id, limits.isPremium, FREE_IMG_LIMIT);
  if (!allowed) {
    return NextResponse.json(
      { error: "image_limit", message: "Лимит изображений исчерпан. Подключите Premium!", limits },
      { status: 429 }
    );
  }

  try {
    const result = await generateImage(body.prompt, body.style ?? "realistic");
    return NextResponse.json({ url: result.url, provider: result.provider });
  } catch (e: any) {
    console.error("Image error:", e);
    return NextResponse.json({ error: "Generation failed" }, { status: 503 });
  }
}
