/**
 * AI clients — LLM (OpenAI-compatible) + Image generation (fal.ai / Replicate)
 */

// ──────────────────────────────────────────────
//  LLM — OpenAI / Groq / any compatible API
// ──────────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  text: string;
  shouldGenerateImage: boolean;
  imagePrompt?: string;
}

const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1";
const LLM_API_KEY  = process.env.LLM_API_KEY  ?? "";
const LLM_MODEL    = process.env.LLM_MODEL    ?? "llama-3.3-70b-versatile";

/**
 * Sends messages to LLM, returns text reply + image generation decision.
 * Image trigger: every N messages (configurable), or if AI decides naturally.
 */
export async function chat(
  characterPersonality: string,
  history: ChatMessage[],
  userMessage: string,
  messageCount: number
): Promise<LLMResponse> {
  // Decide whether to generate image
  const IMAGE_EVERY_N = parseInt(process.env.IMAGE_EVERY_N ?? "5", 10);
  const shouldGenerateImage = messageCount % IMAGE_EVERY_N === 0;

  const systemPrompt = buildSystemPrompt(characterPersonality, shouldGenerateImage);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-10), // last 10 messages for context
    { role: "user", content: userMessage },
  ];

  const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      temperature: 0.85,
      max_tokens: 350,
      ...(shouldGenerateImage && { response_format: { type: "json_object" } }),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ?? "";

  if (shouldGenerateImage) {
    try {
      const parsed = JSON.parse(raw);
      return {
        text: parsed.reply ?? raw,
        shouldGenerateImage: true,
        imagePrompt: parsed.image_prompt ?? "",
      };
    } catch {
      return { text: raw, shouldGenerateImage: false };
    }
  }

  return { text: raw, shouldGenerateImage: false };
}

function buildSystemPrompt(personality: string, requestImage: boolean): string {
  const base = `${personality}

ОБЩИЕ ПРАВИЛА:
- Ты ведёшь диалог от первого лица
- Отвечай живо и эмоционально, 1-3 предложения
- Никогда не выходи из роли
- Учитывай эмоциональный контекст пользователя
- Реагируй на действия в звёздочках (*обнимает тебя*)
- Язык: русский`;

  if (!requestImage) return base;

  return `${base}

ВАЖНО: Сейчас тебе нужно ответить в формате JSON:
{
  "reply": "твой ответ в диалоге",
  "image_prompt": "English prompt for image generation, describing the scene/pose/emotion (40-60 words). Style: photorealistic/anime. Be specific about lighting, setting, expression."
}

image_prompt должен описывать текущую сцену — что ты делаешь, твоё выражение лица, обстановка.`;
}

// ──────────────────────────────────────────────
//  Image generation — fal.ai (Flux) or Replicate
// ──────────────────────────────────────────────

export type ImageStyle = "realistic" | "anime";

export interface ImageResult {
  url: string;
  provider: string;
}

/**
 * Generates image via fal.ai (Flux.1) — primary provider.
 * Falls back to Replicate (SDXL) if fal fails.
 */
export async function generateImage(
  prompt: string,
  style: ImageStyle = "realistic"
): Promise<ImageResult> {
  const styledPrompt = applyStyleModifiers(prompt, style);

  try {
    return await generateWithFal(styledPrompt, style);
  } catch (e) {
    console.error("fal.ai failed, trying Replicate:", e);
    return await generateWithReplicate(styledPrompt, style);
  }
}

function applyStyleModifiers(prompt: string, style: ImageStyle): string {
  if (style === "anime") {
    return `anime illustration, ${prompt}, anime art style, cel shading, detailed, vibrant colors, studio quality`;
  }
  return `${prompt}, photorealistic, 8k, cinematic lighting, detailed skin texture, professional photography`;
}

// ── fal.ai (Flux.1-dev) ──────────────────────
async function generateWithFal(prompt: string, style: ImageStyle): Promise<ImageResult> {
  const FAL_KEY = process.env.FAL_API_KEY ?? "";
  if (!FAL_KEY) throw new Error("FAL_API_KEY not set");

  const model = style === "anime"
    ? "fal-ai/aura-flow"           // good for anime
    : "fal-ai/flux/dev";           // realistic

  // Submit job
  const submitRes = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      image_size: "portrait_4_3",
    }),
  });

  if (!submitRes.ok) throw new Error(`fal submit: ${submitRes.status}`);
  const { request_id } = await submitRes.json();

  // Poll for result
  const resultUrl = `https://queue.fal.run/${model}/requests/${request_id}`;
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const pollRes = await fetch(resultUrl, {
      headers: { "Authorization": `Key ${FAL_KEY}` },
    });
    const pollData = await pollRes.json();
    if (pollData.status === "COMPLETED" && pollData.images?.[0]?.url) {
      return { url: pollData.images[0].url, provider: "fal.ai" };
    }
    if (pollData.status === "FAILED") throw new Error("fal generation failed");
  }
  throw new Error("fal timeout");
}

// ── Replicate (Flux Schnell) fallback ────────────────
async function generateWithReplicate(prompt: string, style: ImageStyle): Promise<ImageResult> {
  const REPLICATE_KEY = process.env.REPLICATE_API_TOKEN ?? "";
  if (!REPLICATE_KEY) throw new Error("REPLICATE_API_TOKEN not set");

  // Flux Schnell — fast, free, works for both styles
  const createRes = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${REPLICATE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "wait=60",
    },
    body: JSON.stringify({
      input: {
        prompt,
        num_outputs: 1,
        aspect_ratio: "3:4",
        output_format: "webp",
        output_quality: 80,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`replicate create: ${createRes.status} ${err}`);
  }
  const prediction = await createRes.json();

  // If Prefer: wait= returned a completed result immediately
  if (prediction.status === "succeeded" && prediction.output?.[0]) {
    return { url: prediction.output[0], provider: "replicate" };
  }

  const pollUrl = prediction.urls?.get;
  if (!pollUrl) throw new Error("replicate: no poll URL");

  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const pollRes = await fetch(pollUrl, {
      headers: { "Authorization": `Bearer ${REPLICATE_KEY}` },
    });
    const data = await pollRes.json();
    if (data.status === "succeeded" && data.output?.[0]) {
      return { url: data.output[0], provider: "replicate" };
    }
    if (data.status === "failed") throw new Error(`replicate failed: ${data.error}`);
  }
  throw new Error("replicate timeout");
}

// ──────────────────────────────────────────────
//  Smart image prompt builder (when LLM doesn't provide one)
// ──────────────────────────────────────────────
export async function buildImagePromptFromContext(
  characterName: string,
  style: ImageStyle,
  lastMessage: string
): Promise<string> {
  const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        {
          role: "system",
          content: `You create image generation prompts. Given a chat context, describe the scene in 40-50 English words. Style: ${style === "anime" ? "anime illustration" : "photorealistic"}. Always include: lighting, setting, character expression, pose.`,
        },
        {
          role: "user",
          content: `Character: ${characterName}. Last message context: "${lastMessage}". Generate image prompt.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? `${characterName}, smiling, warm lighting, detailed face`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
