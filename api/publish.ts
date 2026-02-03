
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

/**
 * Загрузка фото в ВК
 */
async function uploadPhotoToVK(accessToken: string, targetId: number, base64Image: string) {
  const isGroup = targetId < 0;
  const absId = Math.abs(targetId);

  // 1. Получаем сервер для загрузки
  const serverParams: any = {
    access_token: accessToken,
    v: '5.131'
  };
  // Для токенов сообщества group_id ОБЯЗАТЕЛЕН
  if (isGroup) serverParams.group_id = absId;

  const serverRes = await axios.get(`https://api.vk.com/method/photos.getWallUploadServer`, { params: serverParams });

  if (serverRes.data.error) {
    const err = serverRes.data.error;
    throw new Error(`[UploadServer] ${err.error_msg} (код ${err.error_code}). Проверьте права 'photos' в ключе.`);
  }
  
  const uploadUrl = serverRes.data.response.upload_url;

  // 2. Загружаем файл
  const buffer = Buffer.from(base64Image.split(',')[1], 'base64');
  const form = new FormData();
  form.append('photo', buffer, { filename: 'image.png' });

  const uploadRes = await axios.post(uploadUrl, form, { headers: form.getHeaders() });

  // 3. Сохраняем фото на стене
  const saveParams: any = {
    access_token: accessToken,
    photo: uploadRes.data.photo,
    server: uploadRes.data.server,
    hash: uploadRes.data.hash,
    v: '5.131'
  };
  
  if (isGroup) {
    saveParams.group_id = absId;
  } else {
    saveParams.user_id = absId;
  }

  const saveRes = await axios.get(`https://api.vk.com/method/photos.saveWallPhoto`, { params: saveParams });

  if (saveRes.data.error) {
    throw new Error(`[SavePhoto] ${saveRes.data.error.error_msg}`);
  }

  const photo = saveRes.data.response[0];
  return `photo${photo.owner_id}_${photo.id}`;
}

async function publishToVK(accessToken: string, ownerId: string, message: string, image?: string) {
  // Обработка ID: убираем префиксы, но сохраняем минус если он есть
  let cleanIdStr = ownerId.trim().toLowerCase()
    .replace('id', '').replace('club', '').replace('public', '').replace(' ', '');
  
  let numericId = parseInt(cleanIdStr, 10);
  if (isNaN(numericId)) throw new Error('ВК: ID должен быть числом.');

  // Если в строке был "club" или "public" или "-", это точно группа
  const isExplicitGroup = ownerId.includes('-') || ownerId.includes('club') || ownerId.includes('public');
  if (isExplicitGroup && numericId > 0) numericId = -numericId;

  let attachment = "";
  let photoError = "";

  if (image && image.startsWith('data:image')) {
    try {
      attachment = await uploadPhotoToVK(accessToken, numericId, image);
    } catch (e: any) {
      console.error("VK Image Upload Failed:", e.message);
      photoError = ` (Картинка не загружена: ${e.message})`;
    }
  }

  // Публикуем пост (даже если картинка не загрузилась)
  const postRes = await axios.post(`https://api.vk.com/method/wall.post`, null, {
    params: {
      access_token: accessToken,
      owner_id: numericId,
      from_group: numericId < 0 ? 1 : 0,
      message: message,
      attachments: attachment,
      v: '5.131'
    }
  });
  
  if (postRes.data.error) {
    const err = postRes.data.error;
    throw new Error(`ВК: ${err.error_msg} (код ${err.error_code})`);
  }
  
  return photoError ? { partial: true, error: photoError } : { success: true };
}

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

  if (accError || !accounts) return res.status(500).json({ error: 'DB Error' });

  const results = [];

  for (const account of accounts) {
    try {
      if (account.platform === 'Telegram') {
        const botToken = account.credentials.botToken?.trim();
        const rawChatId = (account.credentials.chatId || '').toString().trim();

        if (!botToken || !rawChatId) throw new Error('Данные не заполнены');

        let finalChatId: string | number = rawChatId;
        if (/^-?\d+$/.test(rawChatId)) {
          finalChatId = Number(rawChatId);
        } else if (!rawChatId.startsWith('@')) {
          finalChatId = `@${rawChatId}`;
        }

        const bot = new Telegraf(botToken);
        if (image && image.startsWith('data:image')) {
          const buffer = Buffer.from(image.split(',')[1], 'base64');
          await bot.telegram.sendPhoto(finalChatId, { source: buffer }, { caption: text.slice(0, 1024) });
          if (text.length > 1024) await bot.telegram.sendMessage(finalChatId, text);
        } else {
          await bot.telegram.sendMessage(finalChatId, text);
        }
        results.push({ platform: account.platform, name: account.name, status: 'success' });

      } else if (account.platform === 'VK') {
        const token = account.credentials.accessToken?.trim();
        const ownerId = (account.credentials.ownerId || '').toString().trim();
        
        const vkRes = await publishToVK(token, ownerId, text, image);
        
        results.push({ 
          platform: account.platform, 
          name: account.name, 
          status: vkRes.partial ? 'failed' : 'success', 
          error: vkRes.error || undefined 
        });

      } else {
        results.push({ platform: account.platform, name: account.name, status: 'failed', error: 'Platform not supported' });
      }
    } catch (e: any) {
      let msg = e.message || 'Error';
      if (msg.includes('chat not found')) msg = "ТГ: Чат не найден.";
      results.push({ platform: account.platform, name: account.name, status: 'failed', error: msg });
    }
  }

  return res.status(200).json({ results });
}
