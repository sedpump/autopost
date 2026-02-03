
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Telegraf } from 'telegraf';
import { Buffer } from 'buffer';
import axios from 'axios';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

async function publishToVK(accessToken: string, ownerId: string, message: string) {
  // Для простоты здесь только текстовый пост. 
  // Загрузка фото в ВК требует 3 этапа: получение сервера -> POST файла -> сохранение фото.
  const url = `https://api.vk.com/method/wall.post`;
  const response = await axios.post(url, null, {
    params: {
      access_token: accessToken,
      owner_id: ownerId,
      message: message,
      v: '5.131'
    }
  });
  if (response.data.error) {
    throw new Error(response.data.error.error_msg);
  }
  return response.data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Метод не поддерживается');
  
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Не авторизован' });
  const userId = auth.replace('Bearer ', '');

  const { text, image, articleId } = req.body;

  const { data: accounts, error: accError } = await supabase
    .from('target_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (accError || !accounts) return res.status(500).json({ error: 'Ошибка получения аккаунтов' });

  const results = [];

  for (const account of accounts) {
    let status = 'failed';
    let errorMessage = '';
    
    try {
      if (account.platform === 'Telegram') {
        const botToken = account.credentials.botToken?.trim();
        let chatId = account.credentials.chatId?.trim();

        if (!botToken || !chatId) throw new Error('Bot Token или Chat ID отсутствуют');

        if (!chatId.startsWith('@') && !chatId.startsWith('-') && isNaN(Number(chatId))) {
          chatId = `@${chatId}`;
        }

        const bot = new Telegraf(botToken);
        if (image && image.startsWith('data:image')) {
          const buffer = Buffer.from(image.split(',')[1], 'base64');
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
      } else if (account.platform === 'VK') {
        const token = account.credentials.accessToken?.trim();
        const ownerId = account.credentials.ownerId?.trim();
        if (!token || !ownerId) throw new Error('VK Access Token или Owner ID отсутствуют');
        
        await publishToVK(token, ownerId, text);
        status = 'success';
      } else {
        status = 'pending_integration';
        errorMessage = `Интеграция с платформой ${account.platform} в разработке`;
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
      console.error(`Ошибка публикации [${account.platform}]:`, e);
      results.push({ 
        platform: account.platform, 
        name: account.name, 
        status: 'failed', 
        error: e.message || 'Сетевая ошибка' 
      });
    }
  }

  return res.status(200).json({ success: true, results });
}
