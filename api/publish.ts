
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const userId = auth.replace('Bearer ', '');

  const { text, image, articleId } = req.body;

  // 1. Получаем все активные аккаунты пользователя из БД
  const { data: accounts, error: accError } = await supabase
    .from('target_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (accError || !accounts) return res.status(500).json({ error: 'Failed to fetch target accounts' });

  const results = [];

  // 2. Рассылаем по каждой платформе
  for (const account of accounts) {
    let status = 'failed';
    let link = '';
    
    try {
      if (account.platform === 'Telegram') {
        const { botToken, chatId } = account.credentials;
        const msg = image ? `📸 [Image Content]\n\n${text}` : text;
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          chat_id: chatId,
          text: msg
        });
        status = 'success';
      } 
      // Тут будут блоки else if для VK, Dzen и т.д.
      else {
        // Симуляция для остальных
        status = 'simulated';
      }

      // 3. Записываем в лог
      await supabase.from('posts_history').insert([{
        user_id: userId,
        article_id: articleId,
        platform: account.platform,
        status: status,
        external_link: link
      }]);

      results.push({ platform: account.platform, name: account.name, status });
    } catch (e: any) {
      results.push({ platform: account.platform, name: account.name, status: 'failed', error: e.message });
    }
  }

  return res.status(200).json({ success: true, results });
}
