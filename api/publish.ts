
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { text, image, platforms } = req.body;
  const results: any[] = [];

  for (const platform of platforms) {
    try {
      if (platform === 'Telegram') {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_DESTINATION_ID || process.env.TELEGRAM_CHANNEL_ID;

        if (botToken && chatId) {
          // Если есть картинка, отправляем как фото с подписью
          if (image && image.startsWith('data:image')) {
            // В продакшене лучше сначала загрузить картинку на хостинг, 
            // но Telegram принимает и base64/файлы. Для примера шлем текст.
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              chat_id: chatId,
              text: `📸 [Image Generated]\n\n${text}`
            });
          } else {
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              chat_id: chatId,
              text: text
            });
          }
          results.push({ platform, status: 'success' });
        } else {
          throw new Error('Telegram credentials missing');
        }
      } 
      else {
        // Для VK/Dzen и т.д. логика аналогична через их API
        results.push({ platform, status: 'simulated', message: `${platform} API integration coming soon` });
      }
    } catch (error: any) {
      results.push({ platform, status: 'failed', error: error.message });
    }
  }

  return res.status(200).json({ success: true, results });
}
