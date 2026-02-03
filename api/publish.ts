
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
  // Очищаем ID от буквенных префиксов, сохраняя минус если он есть
  const rawId = ownerId.trim().toLowerCase()
    .replace('id', '')
    .replace('club', '')
    .replace('public', '');
  
  const numericOwnerId = parseInt(rawId, 10);

  if (isNaN(numericOwnerId)) {
    throw new Error('Owner ID должен быть числом (например, 12345 или -12345).');
  }

  const url = `https://api.vk.com/method/wall.post`;
  
  // Если numericOwnerId отрицательный — это группа. 
  // Для групп ОБЯЗАТЕЛЬНО нужен from_group: 1, иначе будет ошибка доступа.
  const isGroup = numericOwnerId < 0;

  const response = await axios.post(url, null, {
    params: {
      access_token: accessToken,
      owner_id: numericOwnerId,
      from_group: isGroup ? 1 : 0, // Постить от имени сообщества
      message: message,
      v: '5.131'
    }
  });
  
  if (response.data.error) {
    const err = response.data.error;
    if (err.error_code === 15) {
      throw new Error('Доступ закрыт. Убедитесь, что у токена есть права на стену и включен параметр "от имени сообщества".');
    }
    throw new Error(`Ошибка ВК: ${err.error_msg} (Код: ${err.error_code})`);
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
        const ownerId = account.credentials.ownerId?.trim() || '';
        
        if (!token || !ownerId) throw new Error('VK Access Token или Owner ID отсутствуют');
        
        await publishToVK(token, ownerId, text);
        status = 'success';
      } else {
        status = 'pending_integration';
        errorMessage = `Интеграция с ${account.platform} пока в очереди`;
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
