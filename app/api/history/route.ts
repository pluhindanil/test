/**
 * GET  /api/history?characterSlug=aria  — история чата
 * DELETE /api/history?characterSlug=aria — очистить историю
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequestSafe } from "@/lib/telegram";
import { upsertUser, getCharacterBySlug, getHistory, clearHistory, initDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) { await initDb(); dbInitialized = true; }
}

export async function GET(req: NextRequest) {
  await ensureDb();
  let parsed;
  try { parsed = getUserFromRequestSafe(req); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const slug = req.nextUrl.searchParams.get("characterSlug");
  if (!slug) return NextResponse.json({ error: "Missing characterSlug" }, { status: 400 });

  const dbUser = await upsertUser(String(parsed.user.id));
  const character = await getCharacterBySlug(slug);
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const history = await getHistory(dbUser.id, character.id, 50);
  return NextResponse.json({ history });
}

export async function DELETE(req: NextRequest) {
  await ensureDb();
  let parsed;
  try { parsed = getUserFromRequestSafe(req); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const slug = req.nextUrl.searchParams.get("characterSlug");
  if (!slug) return NextResponse.json({ error: "Missing characterSlug" }, { status: 400 });

  const dbUser = await upsertUser(String(parsed.user.id));
  const character = await getCharacterBySlug(slug);
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await clearHistory(dbUser.id, character.id);
  return NextResponse.json({ ok: true });
}
