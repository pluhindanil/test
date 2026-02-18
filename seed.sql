DELETE FROM characters;
DELETE FROM sqlite_sequence WHERE name='characters';
-- Добавляем готовых девушек
INSERT INTO characters (user_id, name, personality, style, anchor_image_path, face_embedding, created_at) VALUES
(0, 'Маша', 'Нежная, заботливая, любит романтику и готовить вкусный кофе', 'realistic', '/uploads/predefined/masha.jpg', NULL, datetime('now')),
(0, 'Алиса', 'Страстная, дерзкая, обожает приключения и ночные клубы', 'realistic', '/uploads/predefined/alisa.jpg', NULL, datetime('now')),
(0, 'Лена', 'Скромная, интеллигентная, работает в библиотеке', 'realistic', '/uploads/predefined/lena.jpg', NULL, datetime('now')),
(0, 'Сакура', 'Загадочная аниме-девушка с востока', 'anime', '/uploads/predefined/sakura.jpg', NULL, datetime('now'));