
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Telegraf } from 'telegraf';
import { Buffer } from 'buffer';

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

  // Получаем активные интеграции пользователя
  const { data: accounts, error: accError } = await supabase
    .from('target_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (accError || !accounts) return res.status(500).json({ error: 'Failed to fetch accounts' });

  const results = [];

  for (const account of accounts) {
    let status = 'failed';
    let errorMessage = '';
    
    try {
      if (account.platform === 'Telegram') {
        // Очищаем токен и ID от возможных пробелов
        const botToken = account.credentials.botToken?.trim();
        const chatId = account.credentials.chatId?.trim();

        if (!botToken || !chatId) {
          throw new Error('Bot Token or Chat ID is missing');
        }

        const bot = new Telegraf(botToken);

        if (image && image.startsWith('data:image')) {
          const base64Data = image.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Caption limit is 1024 chars for photos
          if (text.length <= 1024) {
            await bot.telegram.sendPhoto(chatId, { source: buffer }, { caption: text });
          } else {
            await bot.telegram.sendPhoto(chatId, { source: buffer });
            await bot.telegram.sendMessage(chatId, text);
          }
        } else {
          await bot.telegram.sendMessage(chatId, text);
        }
        status = 'success';
      } else {
        status = 'pending_integration';
        errorMessage = `Platform ${account.platform} integration in progress`;
      }

      // Log to history
      await supabase.from('posts_history').insert([{
        user_id: userId,
        article_id: articleId,
        platform: account.platform,
        status: status,
        error_log: errorMessage
      }]);

      results.push({ platform: account.platform, name: account.name, status, error: errorMessage });
    } catch (e: any) {
      console.error(`Publish error [${account.platform}]:`, e);
      // Формируем понятное сообщение об ошибке
      const cleanError = e.description || e.message || 'Unknown network error';
      results.push({ 
        platform: account.platform, 
        name: account.name, 
        status: 'failed', 
        error: `Telegram Error: ${cleanError}` 
      });
    }
  }

  return res.status(200).json({ success: true, results });
}
