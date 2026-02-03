
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  // Можно передавать ID канала через параметры запроса или хранить в ENV
  const CHANNEL_ID = req.query.channelId || process.env.TELEGRAM_CHANNEL_ID;

  if (!BOT_TOKEN || !CHANNEL_ID) {
    // Если ключей нет, возвращаем демо-данные, чтобы интерфейс не ломался
    return res.status(200).json([
      {
        id: 'demo_1',
        source: 'System (Demo Mode)',
        originalText: 'Пожалуйста, добавьте TELEGRAM_BOT_TOKEN в настройки Vercel, чтобы видеть реальные посты.',
        timestamp: new Date().toLocaleTimeString(),
        status: 'pending'
      }
    ]);
  }

  try {
    // Получаем последние обновления от бота
    // ВАЖНО: Бот должен быть администратором в канале/группе
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
    
    const messages = response.data.result
      .filter((m: any) => m.channel_post || m.message)
      .map((m: any) => {
        const msg = m.channel_post || m.message;
        return {
          id: msg.message_id.toString(),
          source: msg.chat.title || 'Telegram Source',
          originalText: msg.text || msg.caption || 'No text content',
          timestamp: new Date(msg.date * 1000).toLocaleTimeString(),
          status: 'pending'
        };
      })
      .reverse(); // Свежие сверху

    return res.status(200).json(messages);
  } catch (error: any) {
    console.error('TG Fetch Error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch from Telegram' });
  }
}
