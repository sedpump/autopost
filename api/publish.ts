
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
 * Загрузка фото в ВК с учетом специфики токенов сообщества
 */
async function uploadPhotoToVK(accessToken: string, targetId: number, base64Image: string) {
  const isGroup = targetId < 0;
  const groupId = Math.abs(targetId);

  // 1. Получаем сервер. ВАЖНО: для токенов сообщества group_id ОБЯЗАТЕЛЕН
  const serverRes = await axios.get(`https://api.vk.com/method/photos.getWallUploadServer`, {
    params: {
      access_token: accessToken,
      group_id: isGroup ? groupId : undefined, // Если это группа, передаем ID без минуса
      v: '5.131'
    }
  });

  if (serverRes.data.error) {
    const err = serverRes.data.error;
    // Ошибка 27 - Group authorization failed обычно значит, что не передан group_id или токен не от этой группы
    if (err.error_code === 27 || err.error_msg.includes('group auth')) {
      throw new Error(`ВК: Ошибка авторизации группы. Убедитесь, что Ключ Доступа создан именно в той группе, ID которой вы указали (${groupId}).`);
    }
    throw new Error(`VK Upload Server Error: ${err.error_msg} (Код: ${err.error_code})`);
  }
  
  const uploadUrl = serverRes.data.response.upload_url;

  // 2. Загружаем байты
  const buffer = Buffer.from(base64Image.split(',')[1], 'base64');
  const form = new FormData();
  form.append('photo', buffer, { filename: 'image.png' });

  const uploadRes = await axios.post(uploadUrl, form, {
    headers: form.getHeaders()
  });

  // 3. Сохраняем. Здесь тоже важен group_id для групповых токенов
  const saveRes = await axios.get(`https://api.vk.com/method/photos.saveWallPhoto`, {
    params: {
      access_token: accessToken,
      group_id: isGroup ? groupId : undefined,
      user_id: !isGroup ? groupId : undefined,
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
  // Очистка ID от лишних букв
  let cleanIdStr = ownerId.trim().toLowerCase()
    .replace('id', '').replace('club', '').replace('public', '').replace(' ', '');
  
  let numericId = parseInt(cleanIdStr, 10);
  if (isNaN(numericId)) throw new Error('ВК: ID должен быть числом.');

  // Если это группа (или похоже на группу), гарантируем минус
  const isGroup = numericId < 0 || ownerId.includes('-') || ownerId.includes('club') || ownerId.includes('public');
  if (isGroup && numericId > 0) numericId = -numericId;

  let attachment = "";
  if (image && image.startsWith('data:image')) {
    attachment = await uploadPhotoToVK(accessToken, numericId, image);
  }

  const response = await axios.post(`https://api.vk.com/method/wall.post`, null, {
    params: {
      access_token: accessToken,
      owner_id: numericId,
      from_group: isGroup ? 1 : 0,
      message: message,
      attachments: attachment,
      v: '5.131'
    }
  });
  
  if (response.data.error) {
    const err = response.data.error;
    throw new Error(`ВК: ${err.error_msg} (Код: ${err.error_code})`);
  }
  return response.data;
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

        if (!botToken || !rawChatId) throw new Error('Telegram: данные не заполнены');

        // ГИБКАЯ ОБРАБОТКА ЧАТ ID
        let finalChatId: string | number = rawChatId;
        // Проверяем, является ли это числом (включая отрицательные)
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
        
        await publishToVK(token, ownerId, text, image);
        results.push({ platform: account.platform, name: account.name, status: 'success' });

      } else {
        results.push({ platform: account.platform, name: account.name, status: 'failed', error: 'Not implemented' });
      }
    } catch (e: any) {
      let msg = e.message || 'Error';
      if (msg.includes('chat not found')) msg = "ТГ: Чат не найден. Проверьте ID и добавьте бота в админы.";
      results.push({ platform: account.platform, name: account.name, status: 'failed', error: msg });
    }
  }

  return res.status(200).json({ results });
}
