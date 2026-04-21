import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequestSafe } from "@/lib/telegram";
import { upsertUser, initDb } from "@/lib/db";

export const runtime = "nodejs";

const PREMIUM_STARS = 199;

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

export async function POST(req: NextRequest) {
  await ensureDb();

  let parsed;
  try {
    parsed = getUserFromRequestSafe(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user: tgUser } = parsed;
  await upsertUser(String(tgUser.id), tgUser.username, tgUser.first_name);

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 503 });
  }

  const payload = JSON.stringify({ telegram_id: String(tgUser.id) });

  const tgRes = await fetch(
    `https://api.telegram.org/bot${botToken}/createInvoiceLink`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Premium подписка",
        description: "30 дней безлимитного общения и доступ ко всем персонажам",
        payload,
        currency: "XTR",
        prices: [{ label: "30 дней Premium", amount: PREMIUM_STARS }],
      }),
    }
  );

  const tgData = await tgRes.json();

  if (!tgData.ok) {
    console.error("Telegram createInvoiceLink error:", tgData);
    return NextResponse.json(
      { error: "Не удалось создать счёт" },
      { status: 502 }
    );
  }

  return NextResponse.json({ invoiceLink: tgData.result });
}
