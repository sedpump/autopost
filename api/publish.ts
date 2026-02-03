
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Telegraf } from 'telegraf';
import { Buffer } from 'buffer';
import axios from 'axios';
import FormData from 'form-data';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

async function uploadPhotoToVK(accessToken: string, ownerId: number, base64Image: string) {
  const isGroup = ownerId < 0;
  const cleanOwnerId = Math.abs(ownerId);

  // 1. Получаем сервер для загрузки
  const serverRes = await axios.get(`https://api.vk.com/method/photos.getWallUploadServer`, {
    params: {
      access_token: accessToken,
      group_id: isGroup ? cleanOwnerId : undefined,
      v: '5.131'
    }
  });

  if (serverRes.data.error) {
    const err = serverRes.data.error;
    if (err.error_code === 15 || err.error_code === 7) {
      throw new Error(`ВК: У токена нет прав на работу с ФОТОГРАФИЯМИ. Пересоздайте ключ и отметьте галочку "Фотографии".`);
    }
    throw new Error(`VK Upload Server Error: ${err.error_msg}`);
  }
  
  const uploadUrl = serverRes.data.response.upload_url;

  // 2. Загружаем файл
  const buffer = Buffer.from(base64Image.split(',')[1], 'base64');
  const form = new FormData();
  form.append('photo', buffer, { filename: 'image.png' });

  const uploadRes = await axios.post(uploadUrl, form, {
    headers: form.getHeaders()
  });

  // 3. Сохраняем фото
  const saveRes = await axios.get(`https://api.vk.com/method/photos.saveWallPhoto`, {
    params: {
      access_token: accessToken,
      group_id: isGroup ? cleanOwnerId : undefined,
      user_id: !isGroup ? cleanOwnerId : undefined,
      photo: uploadRes.data.photo,
      server: uploadRes.data.server,
      hash: uploadRes.data.hash,
      v: '5.131'
    }
  });

  if (saveRes.data.error) {
    throw new Error(`ВК ошибка сохранения фото: ${saveRes.data.error.error_msg}`);
  }

  const photo = saveRes.data.response[0];
  return `photo${photo.owner_id}_${photo.id}`;
}

async function publishToVK(accessToken: string, ownerId: string, message: string, image?: string) {
  let rawId = ownerId.trim().toLowerCase()
    .replace('id', '')
    .replace('club', '')
    .replace('public', '');
  
  let numericOwnerId = parseInt(rawId, 10);
  if (isNaN(numericOwnerId)) throw new Error('ВК: ID должен быть числом.');

  const isGroup = numericOwnerId < 0 || ownerId.includes('-') || ownerId.startsWith('club') || ownerId.startsWith('public');
  if (isGroup && numericOwnerId > 0) numericOwnerId = -numericOwnerId;

  let attachment = "";
  if (image && image.startsWith('data:image')) {
    // Теперь мы НЕ ловим ошибку внутри, а пробрасываем её наверх, чтобы пользователь видел проблему с правами
    attachment = await uploadPhotoToVK(accessToken, numericOwnerId, image);
  }

  try {
    const response = await axios.post(`https://api.vk.com/method/wall.post`, null, {
      params: {
        access_token: accessToken,
        owner_id: numericOwnerId,
        from_group: isGroup ? 1 : 0,
        message: message,
        attachments: attachment,
        v: '5.131'
      }
    });
    
    if (response.data.error) {
      const err = response.data.error;
      if (err.error_code === 15) {
        throw new Error(`ВК Ошибка 15: Доступ запрещен. Проверьте: 1) Вы админ? 2) Стена в группе открыта? 3) В ключе есть права "wall" и "photos"?`);
      }
      throw new Error(`ВК: ${err.error_msg}`);
    }
    return response.data;
  } catch (e: any) {
    throw e;
  }
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
        let chatIdStr = (account.credentials.chatId || '').toString().trim();

        if (!botToken || !chatIdStr) throw new Error('Bot Token или Chat ID отсутствуют');

        // Обработка Chat ID для Telegram
        let finalChatId: string | number = chatIdStr;
        // Если это просто число без знаков, но длинное (ID), пробуем сделать его числом
        if (/^\d+$/.test(chatIdStr)) {
          // Для групп ID обычно отрицательные. Если юзер забыл минус, но это явно ID - это проблема.
          // Но мы оставим как есть, просто приведем к типу Number
          finalChatId = Number(chatIdStr);
        } else if (!chatIdStr.startsWith('@') && !chatIdStr.startsWith('-')) {
          finalChatId = `@${chatIdStr}`;
        }

        const bot = new Telegraf(botToken);
        if (image && image.startsWith('data:image')) {
          const buffer = Buffer.from(image.split(',')[1], 'base64');
          if (text.length <= 1024) {
            await bot.telegram.sendPhoto(finalChatId, { source: buffer }, { caption: text });
          } else {
            await bot.telegram.sendPhoto(finalChatId, { source: buffer });
            await bot.telegram.sendMessage(finalChatId, text);
          }
        } else {
          await bot.telegram.sendMessage(finalChatId, text);
        }
        status = 'success';
      } else if (account.platform === 'VK') {
        const token = account.credentials.accessToken?.trim();
        const ownerId = (account.credentials.ownerId || '').toString().trim();
        
        if (!token || !ownerId) throw new Error('VK Ключ или ID отсутствуют');
        
        await publishToVK(token, ownerId, text, image);
        status = 'success';
      } else {
        errorMessage = `Платформа ${account.platform} пока не поддерживается для автопостинга.`;
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
      let friendlyError = e.message || 'Неизвестная ошибка';
      if (friendlyError.includes('chat not found')) {
        friendlyError = "Чат не найден. Проверьте ID/Username и убедитесь, что бот добавлен в администраторы канала.";
      }
      results.push({ 
        platform: account.platform, 
        name: account.name, 
        status: 'failed', 
        error: friendlyError
      });
    }
  }

  return res.status(200).json({ success: true, results });
}
