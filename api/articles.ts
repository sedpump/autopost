
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
  for (const sourceUrl of requestedSources) {
    try {
      if (sourceUrl.includes('instagram.com/') || sourceUrl.includes('picuki.com/')) {
        // Instagram parsing via Picuki
        let username = sourceUrl.split('/').pop()?.split('?')[0] || '';
        if (!username) continue;
        
        const url = `https://www.picuki.com/profile/${username}`;
        const response = await axios.get(url, { 
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36' 
          } 
        });
        const html = response.data;
        
        // Picuki post description regex
        const descRegex = /<div class="photo-description">([\s\S]*?)<\/div>/g;
        const matches = Array.from(html.matchAll(descRegex)).slice(0, 3);

        for (const m of matches) {
          let text = (m as any)[1].replace(/<[^>]+>/g, '').trim();
          if (text && text.length > 10) {
            allArticles.push({
              id: Math.random().toString(36).substr(2, 9),
              source: `Instagram: ${username}`,
              originalText: text,
              timestamp: 'Instagram',
              status: 'pending'
            });
          }
        }
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
    } catch (e) {
      console.error(`Failed to parse ${sourceUrl}`, e);
    }
  }

  return res.status(200).json(allArticles);
}
