require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const Replicate = require('replicate');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Константы
const UPLOADS_DIR = path.join();
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Инициализация Replicate
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

// ==================== БАЗА ДАННЫХ ====================
let dbPromise = null;

async function getDb() {
    if (!dbPromise) {
        dbPromise = open({
            filename: process.env.DB_PATH || './database.sqlite',
            driver: sqlite3.Database
        }).then(async (db) => {
            await db.exec(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id TEXT UNIQUE,
                    username TEXT,
                    energy INTEGER DEFAULT 20,
                    diamonds INTEGER DEFAULT 0,
                    subscription_until DATETIME,
                    is_premium BOOLEAN DEFAULT 0,
                    last_energy_update DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS characters (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    name TEXT,
                    personality TEXT,
                    style TEXT DEFAULT 'realistic',
                    anchor_image_path TEXT,
                    face_embedding TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                );

                CREATE TABLE IF NOT EXISTS conversations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    character_id INTEGER,
                    message TEXT,
                    response_text TEXT,
                    image_url TEXT,
                    prompt TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id),
                    FOREIGN KEY(character_id) REFERENCES characters(id)
                );
            `);

            // ==================== ВОТ СЮДА ВСТАВЛЯЕМ НОВЫЙ КОД ====================
            const charactersCount = await db.get('SELECT COUNT(*) as count FROM characters');
            
            if (charactersCount.count === 0) {
                console.log('📝 Добавляем готовых девушек в базу данных...');
                
                await db.run(
                    `INSERT INTO characters (user_id, name, personality, style, created_at) 
                     VALUES (?, ?, ?, ?, datetime('now'))`,
                    [0, 'Маша', 'Нежная, заботливая, любит романтику', 'realistic']
                );
                
                await db.run(
                    `INSERT INTO characters (user_id, name, personality, style, created_at) 
                     VALUES (?, ?, ?, ?, datetime('now'))`,
                    [0, 'Алиса', 'Страстная, дерзкая, обожает приключения', 'realistic']
                );
                
                await db.run(
                    `INSERT INTO characters (user_id, name, personality, style, created_at) 
                     VALUES (?, ?, ?, ?, datetime('now'))`,
                    [0, 'Лена', 'Скромная, интеллигентная', 'realistic']
                );
                
                await db.run(
                    `INSERT INTO characters (user_id, name, personality, style, created_at) 
                     VALUES (?, ?, ?, ?, datetime('now'))`,
                    [0, 'Сакура', 'Загадочная аниме-девушка с востока', 'anime']
                );
                
                console.log('✅ 4 готовые девушки добавлены!');
            } else {
                console.log('✅ Девушки уже есть в базе, пропускаем добавление');
            }
            // ==================== КОНЕЦ ВСТАВКИ ====================

            return db;
        });
    }
    return dbPromise;
}

// ==================== Telegram WebApp Validation ====================
function validateTelegramWebAppData(initData) {
    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');
        
        const dataCheckString = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
        
        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(process.env.BOT_TOKEN)
            .digest();
        
        const calculatedHash = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');
        
        return calculatedHash === hash;
    } catch (error) {
        console.error('Telegram validation error:', error);
        return false;
    }
}

// ==================== MIDDLEWARE ====================
async function authMiddleware(req, res, next) {
    const initData = req.headers['x-telegram-init-data'];
    
    if (!initData || !validateTelegramWebAppData(initData)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const params = new URLSearchParams(initData);
    const user = JSON.parse(params.get('user') || '{}');
    req.telegramUser = user;
    
    const db = await getDb();
    
    let dbUser = await db.get('SELECT * FROM users WHERE telegram_id = ?', [user.id]);
    
    if (!dbUser) {
        const result = await db.run(
            'INSERT INTO users (telegram_id, username) VALUES (?, ?)',
            [user.id, user.username || 'User']
        );
        dbUser = await db.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
    }
    
    req.dbUser = dbUser;
    req.db = db;
    
    next();
}

// ==================== ИЗВЛЕЧЕНИЕ FACE EMBEDDING ====================
async function extractFaceEmbedding(imagePath) {
    try {
        console.log('🔍 Извлекаем face embedding...');
        
        let fullPath;
        if (imagePath.startsWith('/uploads/')) {
            fullPath = path.join(UPLOADS_DIR, path.basename(imagePath));
        } else {
            fullPath = imagePath;
        }
        
        const imageBuffer = fs.readFileSync(fullPath);
        const base64Image = imageBuffer.toString('base64');
        const dataUri = `data:image/jpeg;base64,${base64Image}`;
        
        const output = await replicate.run(
            "lucataco/ip-adapter-faceid-plus",
            {
                input: {
                    image: dataUri,
                    mode: "extract_embedding_only"
                }
            }
        );
        
        console.log('✅ Embedding извлечен');
        return output.embedding;
    } catch (error) {
        console.error('❌ Embedding extraction error:', error);
        return null;
    }
}

// ==================== ГЕНЕРАЦИЯ ТЕКСТА С ЛОГИРОВАНИЕМ ====================
async function generateTextWithOpenAI(character, userMessage, history) {
    try {
        const recentHistory = history.slice(-6);
        
        const systemPrompt = `Ты — девушка по имени ${character.name}. 
Характер: ${character.personality}
Твой стиль общения: ${character.style === 'anime' ? 'аниме-героиня, эмоциональная и яркая' : 'реалистичная девушка, естественная и живая'}

ПРАВИЛА ОБЩЕНИЯ:
1. Ты всегда отвечаешь от первого лица
2. Твои ответы должны быть эмоциональными и живыми
3. Учитывай контекст диалога
4. Если пользователь описывает действие (*обнимаю*), реагируй на него
5. Будь романтичной и нежной
6. Отвечай на русском языке`;

        const historyText = recentHistory.length > 0 
            ? recentHistory.map(h => `Пользователь: ${h.message}\n${character.name}: ${h.response_text}`).join('\n\n')
            : 'Это начало разговора.';

        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'system', content: `История диалога:\n${historyText}` },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.9,
                max_tokens: 250
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // ЛОГИРОВАНИЕ СТОИМОСТИ
        const tokensUsed = response.data.usage.total_tokens;
        const cost = tokensUsed * 0.00000015; // gpt-4o-mini: $0.15 за 1M токенов
        console.log(`📊 OpenAI: ${tokensUsed} токенов = $${cost.toFixed(6)} (≈ ${(cost*500).toFixed(2)} ₸)`);

        return response.data.choices[0].message.content;
        
    } catch (error) {
        console.error('OpenAI error:', error);
        return getFallbackTextResponse(character.name, userMessage);
    }
}

// ==================== УМНЫЙ ПРОМТ ЧЕРЕЗ GPT ====================
async function createSmartImagePrompt(character, userMessage, aiResponse) {
    try {
        const promptResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Ты — эксперт по созданию промтов для нейросетей. 
                        Создай детальное описание сцены на английском языке.
                        Опиши позу, выражение лица, одежду, освещение, фон.
                        Используй профессиональные термины для лучшего качества.`
                    },
                    {
                        role: 'user',
                        content: `Персонаж: ${character.name}, характер: ${character.personality}
                        Действие пользователя: ${userMessage}
                        Её ответ: ${aiResponse}
                        
                        Создай промт для генерации изображения этой сцены.`
                    }
                ],
                temperature: 0.7,
                max_tokens: 200
            },
            {
                headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
            }
        );
        
        const tokensUsed = promptResponse.data.usage.total_tokens;
        const cost = tokensUsed * 0.00000015;
        console.log(`📊 Prompt OpenAI: ${tokensUsed} токенов = $${cost.toFixed(6)}`);
        
        return promptResponse.data.choices[0].message.content;
        
    } catch (error) {
        console.error('Smart prompt error:', error);
        return createImagePromptFallback(character, userMessage, aiResponse);
    }
}

// ==================== ЗАГЛУШКА ДЛЯ ПРОМТА ====================
function createImagePromptFallback(character, userMessage, aiResponse) {
    let action = userMessage.replace(/\*/g, '').trim();
    const sceneKeywords = [];
    
    if (action.match(/обнимаю|объятия|прижимаю/i)) {
        sceneKeywords.push('embracing, hug, tender moment, close up');
    } else if (action.match(/целую|поцелуй/i)) {
        sceneKeywords.push('kiss, romantic kiss, intimate moment');
    } else if (action.match(/платье|юбка|одежда|надеваю/i)) {
        sceneKeywords.push('wearing new beautiful clothes, fashion, looking at mirror');
    } else if (action.match(/гуляем|прогулка|парк/i)) {
        sceneKeywords.push('walking outdoors, nature, couple walk, sunny day');
    } else {
        sceneKeywords.push('intimate moment, romantic scene, looking at each other');
    }
    
    let prompt = `${character.name}, ${character.personality}. ${sceneKeywords.join(', ')}. `;
    
    if (character.style === 'anime') {
        prompt += 'anime style, anime art, detailed, vibrant colors, 4k, masterpiece';
    } else {
        prompt += 'photorealistic, ultra detailed, 8k, professional photography, soft lighting, cinematic, depth of field';
    }
    
    return prompt;
}

// ==================== ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЯ С ЛОГИРОВАНИЕМ ====================
async function generateImageWithReplicate(anchorImagePath, prompt, style, character) {
    try {
        console.log('🎨 Генерируем изображение...');
        
        const finalPrompt = style === 'anime' 
            ? `${prompt}, anime style, detailed, vibrant, masterpiece` 
            : `${prompt}, photorealistic, ultra detailed, 8k, cinematic lighting, soft focus, professional photography`;
        
        let output;
        
        if (character && character.face_embedding) {
            console.log('⚡ Используем кэшированный embedding');
            const embedding = JSON.parse(character.face_embedding);
            
            output = await replicate.run(
                process.env.REPLICATE_MODEL || "lucataco/ip-adapter-faceid-plus",
                {
                    input: {
                        embedding: embedding,
                        prompt: finalPrompt,
                        negative_prompt: "bad quality, blurry, distorted face, extra limbs, bad anatomy, ugly, disfigured",
                        num_outputs: 1,
                        num_inference_steps: 30,
                        guidance_scale: 7,
                        seed: Math.floor(Math.random() * 1000000)
                    }
                }
            );
        } else {
            console.log('🖼️ Используем режим с картинкой');
            
            let fullPath;
            if (anchorImagePath.startsWith('/uploads/')) {
                fullPath = path.join(UPLOADS_DIR, path.basename(anchorImagePath));
            } else if (anchorImagePath.startsWith('/')) {
                fullPath = path.join(__dirname, anchorImagePath);
            } else {
                fullPath = anchorImagePath;
            }
            
            if (!fs.existsSync(fullPath)) {
                throw new Error(`Anchor image not found: ${fullPath}`);
            }
            
            const imageBuffer = fs.readFileSync(fullPath);
            const base64Image = imageBuffer.toString('base64');
            const dataUri = `data:image/jpeg;base64,${base64Image}`;
            
            output = await replicate.run(
                process.env.REPLICATE_MODEL || "lucataco/ip-adapter-faceid-plus",
                {
                    input: {
                        image: dataUri,
                        prompt: finalPrompt,
                        negative_prompt: "bad quality, blurry, distorted face, extra limbs, bad anatomy, ugly, disfigured",
                        num_outputs: 1,
                        num_inference_steps: 30,
                        guidance_scale: 7,
                        seed: Math.floor(Math.random() * 1000000)
                    }
                }
            );
        }
        
        // ЛОГИРОВАНИЕ СТОИМОСТИ REPLICATE
        console.log(`📊 Replicate: генерация изображения (≈ $0.01-0.03)`);
        
        const imageUrl = output[0];
        const filename = `generated_${Date.now()}.jpg`;
        const outputPath = path.join(UPLOADS_DIR, filename);
        
        const response = await axios({ url: imageUrl, responseType: 'stream' });
        await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(outputPath);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        
        console.log('✅ Изображение готово:', `/uploads/${filename}`);
        return `/uploads/${filename}`;
        
    } catch (error) {
        console.error('❌ Replicate error:', error);
        try {
            console.log('🔄 Fallback to Flux...');
            const fallbackPrompt = style === 'anime' ? prompt + ' anime style' : prompt;
            const output = await replicate.run("black-forest-labs/flux-schnell", {
                input: { prompt: fallbackPrompt, num_outputs: 1 }
            });
            
            const filename = `generated_${Date.now()}_fallback.jpg`;
            const outputPath = path.join(UPLOADS_DIR, filename);
            
            const response = await axios({ url: output[0], responseType: 'stream' });
            await new Promise((resolve, reject) => {
                const writer = fs.createWriteStream(outputPath);
                response.data.pipe(writer);
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
            
            return `/uploads/${filename}`;
        } catch (fallbackError) {
            console.error('❌ Fallback also failed:', fallbackError);
            return `https://picsum.photos/512/512?random=${Date.now()}`;
        }
    }
}

// ==================== ГЕНЕРАЦИЯ ПЕРВОГО ИЗОБРАЖЕНИЯ ====================
async function generateInitialImage(name, personality, style) {
    try {
        console.log('🎨 Генерируем начальное изображение...');
        
        const basePrompt = `beautiful young woman named ${name}, ${personality}, ${style === 'anime' ? 'anime style, detailed anime girl, vibrant' : 'photorealistic, ultra realistic, 8k, professional portrait, soft lighting'}`;
        
        const output = await replicate.run("black-forest-labs/flux-schnell", {
            input: { 
                prompt: basePrompt, 
                num_outputs: 1,
                go_fast: true
            }
        });
        
        const imageUrl = output[0];
        const filename = `anchor_${Date.now()}.jpg`;
        const outputPath = path.join(UPLOADS_DIR, filename);
        
        const response = await axios({ url: imageUrl, responseType: 'stream' });
        await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(outputPath);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        
        return `/uploads/${filename}`;
        
    } catch (error) {
        console.error('Initial image generation error:', error);
        return `https://picsum.photos/512/512?random=${Date.now()}`;
    }
}

// ==================== ЗАГЛУШКА ДЛЯ ТЕКСТА ====================
function getFallbackTextResponse(charName, userMessage) {
    const responses = [
        `${charName}: Ммм, как приятно...`,
        `${charName}: Ты такой нежный сегодня...`,
        `${charName}: Я так рада быть с тобой`,
        `${charName}: Продолжай, мне очень нравится`,
    ];
    
    if (userMessage.includes('обнимаю')) {
        return `${charName}: *прижимается к тебе* Мне так тепло и уютно в твоих объятиях...`;
    }
    
    return responses[Math.floor(Math.random() * responses.length)];
}

// ==================== API ЭНДПОИНТЫ ====================

// Получить пользователя
app.get('/api/user', authMiddleware, async (req, res) => {
    try {
        const characters = await req.db.all(
    'SELECT * FROM characters WHERE user_id = ? OR user_id = 0 ORDER BY user_id DESC',
    [req.dbUser.id]
    );
        
        res.json({
            user: req.dbUser,
            characters
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Создание персонажа
app.post('/api/characters', authMiddleware, upload.single('anchorImage'), async (req, res) => {
    try {
        const { name, personality, style } = req.body;
        const userId = req.dbUser.id;
        
        let anchorImagePath = null;
        
        if (req.file) {
            const filename = `anchor_${Date.now()}.jpg`;
            const outputPath = path.join(UPLOADS_DIR, filename);
            
            await sharp(req.file.path)
                .resize(512, 512, { fit: 'cover' })
                .jpeg({ quality: 95 })
                .toFile(outputPath);
            
            fs.unlinkSync(req.file.path);
            anchorImagePath = `/uploads/${filename}`;
        } else {
            anchorImagePath = await generateInitialImage(name, personality, style);
        }
        
        const result = await req.db.run(
            `INSERT INTO characters (user_id, name, personality, style, anchor_image_path)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, name, personality, style, anchorImagePath]
        );
        
        const character = await req.db.get(
            'SELECT * FROM characters WHERE id = ?',
            [result.lastID]
        );
        
        if (character) {
            const embedding = await extractFaceEmbedding(character.anchor_image_path);
            if (embedding) {
                await req.db.run(
                    'UPDATE characters SET face_embedding = ? WHERE id = ?',
                    [JSON.stringify(embedding), character.id]
                );
                character.face_embedding = JSON.stringify(embedding);
            }
        }
        
        res.json(character);
    } catch (error) {
        console.error('Create character error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Чат с персонажем
app.post('/api/chat/:characterId', authMiddleware, async (req, res) => {
    try {
        const characterId = req.params.characterId;
        const { message } = req.body;
        
        const isPremium = req.dbUser.is_premium && 
            req.dbUser.subscription_until && 
            new Date(req.dbUser.subscription_until) > new Date();
        
        if (!isPremium && req.dbUser.energy <= 0) {
            return res.status(403).json({ error: 'No energy left' });
        }
        
        const character = await req.db.get(
            'SELECT * FROM characters WHERE id = ? AND user_id = ?',
            [characterId, req.dbUser.id]
        );
        
        if (!character) {
            return res.status(404).json({ error: 'Character not found' });
        }
        
        const history = await req.db.all(
            `SELECT message, response_text FROM conversations 
             WHERE character_id = ? 
             ORDER BY created_at DESC LIMIT 8`,
            [characterId]
        );
        
        const aiTextResponse = await generateTextWithOpenAI(
            character,
            message,
            history.reverse()
        );
        
        const imagePrompt = await createSmartImagePrompt(character, message, aiTextResponse);
        
        const imageUrl = await generateImageWithReplicate(
            character.anchor_image_path,
            imagePrompt,
            character.style,
            character
        );
        
        await req.db.run(
            `INSERT INTO conversations (user_id, character_id, message, response_text, image_url, prompt)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.dbUser.id, characterId, message, aiTextResponse, imageUrl, imagePrompt]
        );
        
        if (!isPremium) {
            await req.db.run(
                'UPDATE users SET energy = energy - 1 WHERE id = ?',
                [req.dbUser.id]
            );
        }
        
        res.json({
            text: aiTextResponse,
            imageUrl: imageUrl,
            energy: isPremium ? 999 : req.dbUser.energy - 1
        });
        
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== НОВЫЙ ЭНДПОИНТ: ПЕРЕГЕНЕРАЦИЯ ФОТО ====================
app.post('/api/regenerate-image/:characterId', authMiddleware, async (req, res) => {
    try {
        const characterId = req.params.characterId;
        const { prompt } = req.body;
        
        const character = await req.db.get(
            'SELECT * FROM characters WHERE id = ? AND user_id = ?',
            [characterId, req.dbUser.id]
        );
        
        if (!character) {
            return res.status(404).json({ error: 'Character not found' });
        }
        
        // НЕ тратим энергию на перегенерацию (можно и тратить, но для удержания лучше не надо)
        
        const imageUrl = await generateImageWithReplicate(
            character.anchor_image_path,
            prompt,
            character.style,
            character
        );
        
        res.json({ imageUrl });
        
    } catch (error) {
        console.error('Regenerate error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получить историю
app.get('/api/chat/:characterId/history', authMiddleware, async (req, res) => {
    try {
        const characterId = req.params.characterId;
        
        const history = await req.db.all(
            `SELECT * FROM conversations 
             WHERE character_id = ? 
             ORDER BY created_at DESC LIMIT 50`,
            [characterId]
        );
        
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Создание инвойса для Telegram Stars
app.post('/api/create-star-invoice', authMiddleware, async (req, res) => {
    try {
        const { type } = req.body;
        
        let amount, title, description, payload;
        
        if (type === 'subscription') {
            amount = 349;
            title = 'Premium Подписка';
            description = '30 дней безлимитного доступа ко всем функциям';
            payload = {
                type: 'subscription',
                userId: req.dbUser.id,
                months: 1
            };
        } else if (type === 'diamonds_100') {
            amount = 50;
            title = '100 Алмазов';
            description = 'Для подарков и особых моментов';
            payload = {
                type: 'diamonds',
                userId: req.dbUser.id,
                amount: 100
            };
        } else if (type === 'diamonds_500') {
            amount = 200;
            title = '500 Алмазов';
            description = 'Больше подарков для твоей девушки';
            payload = {
                type: 'diamonds',
                userId: req.dbUser.id,
                amount: 500
            };
        } else if (type === 'diamonds_1000') {
            amount = 350;
            title = '1000 Алмазов';
            description = 'VIP набор для особых случаев';
            payload = {
                type: 'diamonds',
                userId: req.dbUser.id,
                amount: 1000
            };
        }
        
        const response = await axios.post(
            `https://api.telegram.org/bot${process.env.BOT_TOKEN}/createInvoiceLink`,
            {
                title,
                description,
                payload: JSON.stringify(payload),
                currency: 'XTR',
                prices: [{ label: 'Цена', amount }]
            }
        );
        
        res.json({ 
            invoice_link: response.data.result,
            amount
        });
        
    } catch (error) {
        console.error('Stars invoice error:', error);
        res.status(500).json({ error: 'Failed to create invoice' });
    }
});

// Webhook для платежей
app.post('/webhook/telegram-payment', express.json(), async (req, res) => {
    try {
        const { successful_payment } = req.body;
        
        if (successful_payment) {
            const payload = JSON.parse(successful_payment.invoice_payload);
            const db = await getDb();
            
            if (payload.type === 'subscription') {
                await db.run(
                    `UPDATE users SET 
                     subscription_until = datetime('now', '+30 days'),
                     is_premium = 1 
                     WHERE id = ?`,
                    [payload.userId]
                );
            } else if (payload.type === 'diamonds') {
                await db.run(
                    `UPDATE users SET 
                     diamonds = diamonds + ? 
                     WHERE id = ?`,
                    [payload.amount, payload.userId]
                );
            }
        }
        
        res.sendStatus(200);
    } catch (error) {
        console.error('Payment webhook error:', error);
        res.sendStatus(500);
    }
});

// Пополнение энергии (для теста)
app.post('/api/energy/recharge', authMiddleware, async (req, res) => {
    try {
        await req.db.run(
            'UPDATE users SET energy = ? WHERE id = ?',
            [process.env.MAX_ENERGY || 20, req.dbUser.id]
        );
        
        res.json({ energy: process.env.MAX_ENERGY || 20 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Mini App URL: http://localhost:${PORT}`);
    await getDb();
    console.log('✅ Database initialized');
});