
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  // Получаем список источников из запроса
  const requestedSources = ((req.query.sources as string) || '').split(',').filter(Boolean);

  if (!BOT_TOKEN) {
    return res.status(200).json([
      {
        id: 'error_token',
        source: 'System',
        originalText: 'Ошибка: TELEGRAM_BOT_TOKEN не установлен в настройках Vercel.',
        timestamp: new Date().toLocaleTimeString(),
        status: 'pending'
      }
    ]);
  }

  try {
    // В реальном приложении для скрапинга произвольных каналов нужен Telegram User API (MTProto).
    // Через Bot API мы можем получать сообщения только если бот администратор или если в него пишут.
    // Эмулируем сбор, фильтруя getUpdates по названию чатов/каналов из списка источников.
    
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
    
    let messages = response.data.result
      .filter((m: any) => m.channel_post || m.message)
      .map((m: any) => {
        const msg = m.channel_post || m.message;
        const chatTitle = msg.chat.title || msg.chat.username || 'Unknown';
        
        return {
          id: msg.message_id.toString(),
          source: chatTitle,
          originalText: msg.text || msg.caption || 'No text content',
          timestamp: new Date(msg.date * 1000).toLocaleTimeString(),
          status: 'pending',
          chatId: msg.chat.id
        };
      });

    // Если пользователь указал конкретные источники, фильтруем по ним
    if (requestedSources.length > 0) {
        messages = messages.filter((m: any) => {
            const cleanSource = m.source.toLowerCase();
            return requestedSources.some(s => 
                s.toLowerCase().includes(cleanSource) || cleanSource.includes(s.toLowerCase().replace('@', ''))
            );
        });
    }

    // Если после фильтрации пусто, но запросы были - возвращаем заглушку-инструкцию
    if (messages.length === 0 && requestedSources.length > 0) {
        return res.status(200).json([
            {
                id: 'instruction',
                source: 'System',
                originalText: `Бот запущен, но не видит постов в ${requestedSources.join(', ')}. Убедитесь, что: \n1. Бот добавлен в эти каналы как администратор.\n2. В каналах были новые посты после запуска бота.`,
                timestamp: new Date().toLocaleTimeString(),
                status: 'pending'
            }
        ]);
    }

    return res.status(200).json(messages.reverse());
  } catch (error: any) {
    console.error('TG Fetch Error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch from Telegram' });
  }
}
