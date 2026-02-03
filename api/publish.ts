
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
        const botToken = account.credentials.botToken?.trim();
        let chatId = account.credentials.chatId?.trim();

        if (!botToken || !chatId) {
          throw new Error('Bot Token or Chat ID is missing');
        }

        // Авто-нормализация Chat ID
        // Если это не число и не начинается с @ или -, добавляем @
        if (!chatId.startsWith('@') && !chatId.startsWith('-') && isNaN(Number(chatId))) {
          chatId = `@${chatId}`;
        }

        const bot = new Telegraf(botToken);

        if (image && image.startsWith('data:image')) {
          const base64Data = image.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          
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
      let cleanError = e.description || e.message || 'Unknown network error';
      
      // Специфическая подсказка для "chat not found"
      if (cleanError.includes('chat not found')) {
        cleanError += ". Проверьте, что ID канала верен (начинается с @) и бот добавлен в администраторы.";
      }

      results.push({ 
        platform: account.platform, 
        name: account.name, 
        status: 'failed', 
        error: cleanError 
      });
    }
  }

  return res.status(200).json({ success: true, results });
}
