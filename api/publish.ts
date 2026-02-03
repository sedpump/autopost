
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
  try {
    const isGroup = ownerId < 0;
    const cleanOwnerId = Math.abs(ownerId);

    // 1. Получаем сервер для загрузки
    const getUploadServerUrl = `https://api.vk.com/method/photos.getWallUploadServer`;
    const serverRes = await axios.get(getUploadServerUrl, {
      params: {
        access_token: accessToken,
        group_id: isGroup ? cleanOwnerId : undefined,
        v: '5.131'
      }
    });

    if (serverRes.data.error) throw new Error(`VK Upload Server Error: ${serverRes.data.error.error_msg}`);
    const uploadUrl = serverRes.data.response.upload_url;

    // 2. Загружаем файл
    const buffer = Buffer.from(base64Image.split(',')[1], 'base64');
    const form = new FormData();
    form.append('photo', buffer, { filename: 'image.png' });

    const uploadRes = await axios.post(uploadUrl, form, {
      headers: form.getHeaders()
    });

    // 3. Сохраняем фото на стену
    const saveUrl = `https://api.vk.com/method/photos.saveWallPhoto`;
    const saveRes = await axios.get(saveUrl, {
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

    if (saveRes.data.error) throw new Error(`VK Photo Save Error: ${saveRes.data.error.error_msg}`);
    const photo = saveRes.data.response[0];
    return `photo${photo.owner_id}_${photo.id}`;
  } catch (e: any) {
    console.error("VK Image Upload Failed:", e.message);
    return null; // Если не вышло — постим без картинки
  }
}

async function publishToVK(accessToken: string, ownerId: string, message: string, image?: string) {
  let rawId = ownerId.trim().toLowerCase()
    .replace('id', '')
    .replace('club', '')
    .replace('public', '');
  
  let numericOwnerId = parseInt(rawId, 10);
  if (isNaN(numericOwnerId)) throw new Error('ВК: ID должен быть числом.');

  // Почти всегда посты идут в группы, а группы — это отрицательные ID.
  // Если пользователь ввел "123", а это группа, ВК не поймет. Мы страхуемся.
  const isGroup = numericOwnerId < 0 || ownerId.includes('-') || ownerId.startsWith('club') || ownerId.startsWith('public');
  if (isGroup && numericOwnerId > 0) numericOwnerId = -numericOwnerId;

  // Если есть картинка — пробуем загрузить её сначала
  let attachment = "";
  if (image && image.startsWith('data:image')) {
    const photoId = await uploadPhotoToVK(accessToken, numericOwnerId, image);
    if (photoId) attachment = photoId;
  }

  const url = `https://api.vk.com/method/wall.post`;
  try {
    const response = await axios.post(url, null, {
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
        throw new Error(`ВК Доступ запрещен (Код 15). Ключу не хватает прав "wall" (стена) или "photos" (если есть картинка). Также проверьте, являетесь ли вы админом группы ${numericOwnerId}.`);
      }
      if (err.error_code === 100) {
        throw new Error(`ВК Параметр передан неверно (Код 100). Проверьте ID группы/пользователя: ${ownerId}`);
      }
      throw new Error(`ВК: ${err.error_msg} (Код: ${err.error_code})`);
    }
    return response.data;
  } catch (e: any) {
    if (e.message.includes('ВК')) throw e;
    throw new Error(`Сетевая ошибка ВК: ${e.message}`);
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
        let chatId = account.credentials.chatId?.trim();

        if (!botToken || !chatId) throw new Error('Bot Token или Chat ID отсутствуют');

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
        
        if (!token || !ownerId) throw new Error('VK Ключ или ID отсутствуют');
        
        await publishToVK(token, ownerId, text, image);
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
