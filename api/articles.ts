
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
  const { data: sources, error } = await supabase
    .from('sources')
    .select('url')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error || !sources || sources.length === 0) {
    return res.status(200).json([]); // Нет источников — нет статей
  }

  const requestedSources = sources.map(s => s.url);
  const allArticles: any[] = [];

  // 2. Парсим каждый канал
  for (const username of requestedSources) {
    try {
      const url = `https://t.me/s/${username.replace('@', '')}`;
      const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = response.data;
      
      const messageRegex = /<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/g;
      const matches = Array.from(html.matchAll(messageRegex)).reverse().slice(0, 3);

      for (const m of matches) {
        let text = (m as any)[1].replace(/<[^>]+>/g, '').trim();
        if (text) {
          allArticles.push({
            id: Math.random().toString(36).substr(2, 9),
            source: username,
            originalText: text,
            timestamp: 'Just now',
            status: 'pending'
          });
        }
      }
    } catch (e) {
      console.error(`Failed to parse ${username}`, e);
    }
  }

  return res.status(200).json(allArticles);
}
