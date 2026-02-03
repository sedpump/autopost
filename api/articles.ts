
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  const sourcesStr = (req.query.sources as string) || '';
  const requestedSources = sourcesStr.split(',').filter(Boolean).map(s => s.trim().replace('@', ''));

  if (requestedSources.length === 0) {
    return res.status(200).json([]);
  }

  const allArticles: any[] = [];

  for (const username of requestedSources) {
    try {
      // Telegram предоставляет публичное веб-превью по адресу t.me/s/username
      const url = `https://t.me/s/${username}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const html = response.data;
      
      // Очень простой парсинг через регулярки (в идеале использовать cheerio, но для легкости функций обойдемся так)
      // Ищем блоки сообщений
      const messageRegex = /<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/g;
      const timeRegex = /<time[^>]*datetime="([^"]*)"[^>]*>/;
      
      let match;
      let count = 0;
      
      // Забираем последние 5 сообщений из каждого канала
      const matches = Array.from(html.matchAll(messageRegex)).reverse().slice(0, 5);

      for (const m of matches) {
        let text = m[1]
          .replace(/<br\s*\/?>/gi, '\n') // сохраняем переносы строк
          .replace(/<[^>]+>/g, '') // удаляем остальные теги
          .trim();

        if (text) {
          allArticles.push({
            id: `${username}_${Date.now()}_${count++}`,
            source: `@${username}`,
            originalText: text,
            timestamp: new Date().toLocaleTimeString(), // В реальности можно парсить из timeRegex
            status: 'pending'
          });
        }
      }
    } catch (error: any) {
      console.error(`Error scraping channel ${username}:`, error.message);
      // Добавляем уведомление об ошибке в ленту для наглядности
      allArticles.push({
        id: `error_${username}`,
        source: 'System',
        originalText: `Не удалось загрузить посты из @${username}. Возможно, канал приватный или указан неверно.`,
        timestamp: new Date().toLocaleTimeString(),
        status: 'error'
      });
    }
  }

  // Сортируем (условно) и отдаем
  return res.status(200).json(allArticles);
}
