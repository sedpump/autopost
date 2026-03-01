
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const userId = auth.replace('Bearer ', '');

  // 1. Достаем источники пользователя из БД
  const { data: sources, error: dbError } = await supabase
    .from('sources')
    .select('url')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (dbError) {
    console.error('Supabase error:', dbError);
    return res.status(500).json({ error: 'Ошибка базы данных' });
  }

  if (!sources || sources.length === 0) {
    return res.status(200).json([]); // Нет источников — нет статей
  }

  const requestedSources = sources.map(s => s.url);
  const allArticles: any[] = [];

  // 2. Парсим каждый канал
  for (const sourceUrl of requestedSources) {
    try {
      if (sourceUrl.includes('instagram.com/') || sourceUrl.includes('picuki.com/')) {
        // Instagram parsing is now handled by Gemini in the frontend
        continue;
      } else {
        // Telegram parsing
        const username = sourceUrl.replace('@', '');
        const url = `https://t.me/s/${username}`;
        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = response.data;
        
        const messageRegex = /<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/g;
        const matches = Array.from(html.matchAll(messageRegex)).reverse().slice(0, 3);

        for (const m of matches) {
          let text = (m as any)[1].replace(/<[^>]+>/g, '').trim();
          if (text) {
            allArticles.push({
              id: Math.random().toString(36).substr(2, 9),
              source: sourceUrl,
              originalText: text,
              timestamp: 'Telegram',
              status: 'pending'
            });
          }
        }
      }
    } catch (e: any) {
      console.error(`Failed to parse ${sourceUrl}`, e);
    }
  }

  // Если статей нет, но были ошибки — можем вернуть их для отладки (опционально)
  // return res.status(200).json(allArticles.length > 0 ? allArticles : { debug: debugInfo });
  return res.status(200).json(allArticles);
}
