/**
 * POST /api/chat
 * ИСПРАВЛЕНО: атомарные счётчики лимитов (защита от race condition)
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequestSafe } from "@/lib/telegram";
import {
  upsertUser,
  resetDailyCountsIfNeeded,
  getCharacterBySlug,
  getHistory,
  saveMessage,
  tryConsumeMessage,
  tryConsumeImage,
  getLimits,
  FREE_MSG_LIMIT,
  FREE_IMG_LIMIT,
  initDb,
} from "@/lib/db";
import { chat, generateImage, buildImagePromptFromContext } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Инициализируем БД при первом запросе
let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

export async function POST(req: NextRequest) {
  await ensureDb();

  // ── Auth ──────────────────────────────────────
  let parsed;
  try {
    parsed = getUserFromRequestSafe(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user: tgUser } = parsed;

  // ── Parse body ────────────────────────────────
  let body: { characterSlug: string; message: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { characterSlug, message } = body;
  if (!characterSlug || !message?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (message.length > 1000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  // ── DB: user ─────────────────────────────────
  let dbUser = await upsertUser(String(tgUser.id), tgUser.username, tgUser.first_name);
  dbUser = await resetDailyCountsIfNeeded(dbUser);

  const limits = getLimits(dbUser);

  // ── Character ─────────────────────────────────
  const character = await getCharacterBySlug(characterSlug);
  if (!character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  if (character.is_premium && !limits.isPremium) {
    return NextResponse.json(
      { error: "premium_required", message: "Этот персонаж доступен только Premium пользователям" },
      { status: 403 }
    );
  }

  // ── ИСПРАВЛЕНО: атомарная проверка и списание лимита ──
  const messageAllowed = await tryConsumeMessage(dbUser.id, limits.isPremium, FREE_MSG_LIMIT);
  if (!messageAllowed) {
    return NextResponse.json(
      {
        error: "daily_limit",
        message: "Дневной лимит сообщений исчерпан. Оформите подписку!",
        limits,
      },
      { status: 429 }
    );
  }

  // ── Load history ──────────────────────────────
  const history = await getHistory(dbUser.id, character.id, 12);
  const chatHistory = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const messageCount = dbUser.messages_today + 1;

  // ── Сохраняем сообщение пользователя ─────────
  await saveMessage(dbUser.id, character.id, "user", message);

  // ── LLM ──────────────────────────────────────
  let llmResult;
  try {
    llmResult = await chat(character.personality, chatHistory, message, messageCount);
  } catch (e: any) {
    console.error("LLM error:", e?.message ?? e);
    return NextResponse.json({ error: "AI unavailable", detail: e?.message }, { status: 503 });
  }

  // ── Image generation ──────────────────────────
  let imageUrl: string | undefined;
  let imageGenerationFailed = false;

  if (llmResult.shouldGenerateImage) {
    const imageAllowed = await tryConsumeImage(dbUser.id, limits.isPremium, FREE_IMG_LIMIT);

    if (imageAllowed) {
      try {
        const prompt =
          llmResult.imagePrompt ||
          (await buildImagePromptFromContext(character.name, character.style as any, llmResult.text));

        const imgResult = await generateImage(prompt, character.style as any);
        imageUrl = imgResult.url;
      } catch (e) {
        console.error("Image generation failed:", e);
        imageGenerationFailed = true;
      }
    }
  }

  // ── Сохраняем ответ ассистента ────────────────
  await saveMessage(dbUser.id, character.id, "assistant", llmResult.text, imageUrl);

  // ── Обновлённые лимиты ────────────────────────
  const freshUser = await upsertUser(String(tgUser.id));
  const updatedLimits = getLimits(freshUser);

  return NextResponse.json({
    text: llmResult.text,
    imageUrl,
    imageGenerationFailed,
    limits: updatedLimits,
    messageCount,
  });
}
