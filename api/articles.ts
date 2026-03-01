
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
  const debugInfo: any[] = [];
  for (const sourceUrl of requestedSources) {
    try {
      if (sourceUrl.includes('instagram.com/') || sourceUrl.includes('picuki.com/')) {
        // Instagram parsing via Picuki
        const urlParts = sourceUrl.split('/').filter((p: string) => p.length > 0);
        let username = urlParts.pop()?.split('?')[0] || '';
        
        // Если последний элемент был 'profile', берем предыдущий (для ссылок picuki)
        if (username === 'profile' && urlParts.length > 0) {
          username = urlParts.pop() || '';
        }
        
        if (!username) continue;
        
        const url = `https://www.picuki.com/profile/${username}`;
        debugInfo.push(`Trying Picuki: ${url}`);
        
        const response = await axios.get(url, { 
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
          },
          timeout: 15000,
          validateStatus: () => true // Получаем любой статус для отладки
        });

        if (response.status !== 200) {
          debugInfo.push(`Picuki error ${response.status} for ${username}`);
          continue;
        }

        const html = response.data;
        
        // Более широкий поиск описаний (Picuki может менять верстку)
        // Ищем все div с классом photo-description
        const descRegex = /<div class="photo-description">([\s\S]*?)<\/div>/g;
        let match;
        let count = 0;
        
        while ((match = descRegex.exec(html)) !== null && count < 5) {
          let text = match[1].replace(/<[^>]+>/g, '').trim();
          // Декодируем HTML-сущности (например &quot;)
          text = text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");
          
          if (text && text.length > 3) {
            allArticles.push({
              id: Math.random().toString(36).substr(2, 9),
              source: `Instagram: ${username}`,
              originalText: text,
              timestamp: 'Instagram',
              status: 'pending'
            });
            count++;
          }
        }
        debugInfo.push(`Found ${count} posts for ${username}`);
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
      debugInfo.push(`Error parsing ${sourceUrl}: ${e.message}`);
    }
  }

  // Если статей нет, но были ошибки — можем вернуть их для отладки (опционально)
  // return res.status(200).json(allArticles.length > 0 ? allArticles : { debug: debugInfo });
  return res.status(200).json(allArticles);
}
