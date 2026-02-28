import asyncio
import logging
from aiogram.client.default import DefaultBotProperties
import os
import json
import httpx
from aiogram import Bot, Dispatcher, F, Router
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart, Command
from aiogram.types import (
    Message,
    WebAppInfo,
    MenuButtonWebApp,
    BotCommand,
    ReplyKeyboardMarkup,
    KeyboardButton,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from aiohttp import web
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BOT_TOKEN      = os.getenv("BOT_TOKEN", "")
WEBAPP_URL     = os.getenv("WEBAPP_URL", "https://your-domain.com")
WEBHOOK_HOST   = os.getenv("WEBHOOK_HOST", "")
WEBHOOK_PATH   = os.getenv("WEBHOOK_PATH", "/webhook/bot")
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "supersecret")
INTERNAL_SECRET = os.getenv("INTERNAL_SECRET", "")
WEB_PORT       = int(os.getenv("PORT", 8080))

bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp  = Dispatcher()
router = Router()
dp.include_router(router)


# ──────────────────────────────────────────────
#  /start
# ──────────────────────────────────────────────
@router.message(CommandStart())
async def cmd_start(message: Message):
    kb = InlineKeyboardBuilder()
    kb.button(
        text="💜 Открыть приложение",
        web_app=WebAppInfo(url=WEBAPP_URL),
    )
    kb.adjust(1)

    await message.answer(
        "👋 Добро пожаловать!\n\n"
        "Здесь ты можешь общаться с AI-персонажами и получать "
        "уникальные изображения, созданные специально для тебя.\n\n"
        "Нажми кнопку ниже, чтобы начать 👇",
        reply_markup=kb.as_markup(),
    )


# ──────────────────────────────────────────────
#  /app — keyboard button
# ──────────────────────────────────────────────
@router.message(Command("app"))
async def cmd_app(message: Message):
    kb = ReplyKeyboardMarkup(
        keyboard=[[
            KeyboardButton(
                text="💜 Открыть Mini App",
                web_app=WebAppInfo(url=WEBAPP_URL),
            )
        ]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )
    await message.answer("Нажми кнопку ниже:", reply_markup=kb)


# ──────────────────────────────────────────────
#  /help
# ──────────────────────────────────────────────
@router.message(Command("help"))
async def cmd_help(message: Message):
    await message.answer(
        "📖 <b>Как пользоваться:</b>\n\n"
        "1. Нажми /start или кнопку <b>Menu</b> внизу\n"
        "2. Выбери персонажа\n"
        "3. Начни диалог — AI ответит и пришлёт картинку\n\n"
        "💎 <b>Подписка Premium</b> — безлимитное общение\n"
        "⚡ Бесплатно: 20 сообщений в день"
    )


# ──────────────────────────────────────────────
#  Обработка данных от Mini App (sendData)
# ──────────────────────────────────────────────
@router.message(F.web_app_data)
async def handle_webapp_data(message: Message):
    try:
        data = json.loads(message.web_app_data.data)
        action = data.get("action")

        if action == "purchase_complete":
            amount = data.get("amount", 0)
            await message.answer(
                f"✅ Покупка на {amount} Stars прошла успешно!\n"
                "Ваш аккаунт обновлён."
            )
        elif action == "share_image":
            image_url = data.get("url", "")
            await message.answer_photo(
                photo=image_url,
                caption="🎨 Мой AI-персонаж создал это для меня!"
            )
        else:
            logger.warning("Unknown webapp action: %s", action)

    except Exception as e:
        logger.error("webapp_data error: %s", e)


# ──────────────────────────────────────────────
#  Успешный платёж (Telegram Stars)
#  ИСПРАВЛЕНО: теперь вызывает Next.js API для активации Premium
# ──────────────────────────────────────────────
@router.message(F.successful_payment)
async def handle_payment(message: Message):
    payment = message.successful_payment

    try:
        payload = json.loads(payment.invoice_payload)
    except Exception:
        payload = {}

    logger.info("Payment received: %s stars, payload=%s", payment.total_amount, payload)

    # Вызываем внутренний API Next.js — активируем Premium в базе данных
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{WEBAPP_URL}/api/internal/activate",
                json=payload,
                headers={"x-internal-secret": INTERNAL_SECRET},
                timeout=10,
            )
            if resp.status_code == 200:
                logger.info("Premium activated for payload: %s", payload)
                await message.answer(
                    "🎉 <b>Спасибо за покупку!</b>\n\n"
                    f"Сумма: {payment.total_amount} Stars\n"
                    "✅ Ваш аккаунт обновлён — Premium активирован!"
                )
            else:
                logger.error("Activate API error: %s %s", resp.status_code, resp.text)
                await message.answer(
                    "✅ Оплата получена!\n"
                    "⏳ Аккаунт будет обновлён в течение минуты."
                )
    except Exception as e:
        logger.error("Failed to call activate API: %s", e)
        await message.answer(
            "✅ Оплата получена!\n"
            "⏳ Аккаунт будет обновлён в течение минуты."
        )


# ──────────────────────────────────────────────
#  Установка Menu Button и команд
# ──────────────────────────────────────────────
async def setup_bot():
    await bot.set_chat_menu_button(
        menu_button=MenuButtonWebApp(
            text="💜 Открыть",
            web_app=WebAppInfo(url=WEBAPP_URL),
        )
    )
    await bot.set_my_commands([
        BotCommand(command="start", description="Запустить бота"),
        BotCommand(command="app",   description="Открыть Mini App"),
        BotCommand(command="help",  description="Помощь"),
    ])
    logger.info("Bot setup complete. WEBAPP_URL=%s", WEBAPP_URL)


# ──────────────────────────────────────────────
#  Polling mode (dev)
# ──────────────────────────────────────────────
async def run_polling():
    await setup_bot()
    await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())


# ──────────────────────────────────────────────
#  Webhook mode (production)
# ──────────────────────────────────────────────
async def run_webhook():
    await setup_bot()

    webhook_url = f"{WEBHOOK_HOST}{WEBHOOK_PATH}"
    await bot.set_webhook(
        url=webhook_url,
        secret_token=WEBHOOK_SECRET,
        drop_pending_updates=True,
    )
    logger.info("Webhook set: %s", webhook_url)

    app = web.Application()
    handler = SimpleRequestHandler(
        dispatcher=dp,
        bot=bot,
        secret_token=WEBHOOK_SECRET,
    )
    handler.register(app, path=WEBHOOK_PATH)
    setup_application(app, dp, bot=bot)
    return app


# ──────────────────────────────────────────────
#  Entry point
# ──────────────────────────────────────────────
if __name__ == "__main__":
    MODE = os.getenv("BOT_MODE", "polling")
    if MODE == "webhook":
        app = asyncio.get_event_loop().run_until_complete(run_webhook())
        web.run_app(app, host="0.0.0.0", port=WEB_PORT)
    else:
        asyncio.run(run_polling())
