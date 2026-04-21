import { NextRequest, NextResponse } from "next/server";
import { activatePremium, initDb } from "@/lib/db";

export const runtime = "nodejs";

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

export async function POST(req: NextRequest) {
  await ensureDb();

  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { telegram_id: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { telegram_id } = body;
  if (!telegram_id) {
    return NextResponse.json({ error: "Missing telegram_id" }, { status: 400 });
  }

  await activatePremium(String(telegram_id));

  return NextResponse.json({ ok: true });
}
