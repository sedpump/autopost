
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
 * Получение буфера изображения.
 */
async function getImageBuffer(imageData: string): Promise<Buffer> {
  if (!imageData) throw new Error('Данные изображения отсутствуют');
  
  try {
    if (imageData.startsWith('data:image')) {
      const base64Data = imageData.split(',')[1];
      return Buffer.from(base64Data, 'base64');
    } 
    
    if (imageData.startsWith('http')) {
      const response = await axios.get(imageData, { 
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 OmniPost/1.0' }
      });
      return Buffer.from(response.data);
    }
    // Пробуем как чистый base64
    return Buffer.from(imageData, 'base64');
  } catch (e: any) {
    throw new Error(`Ошибка изображения: ${e.message}`);
  }
}

/**
 * Загрузка фото в ВК
 */
async function uploadPhotoToVK(accessToken: string, targetId: number, imageData: string) {
  const absId = Math.abs(targetId);
  
  const getServer = async (isGroup: boolean) => {
    const params: any = { access_token: accessToken, v: '5.131' };
    if (isGroup || targetId < 0) params.group_id = absId;

    const res = await axios.get(`https://api.vk.com/method/photos.getWallUploadServer`, { params });
    if (res.data.error) {
      if (res.data.error.error_code === 27 && !isGroup) return getServer(true);
      throw new Error(`VK Upload Server: ${res.data.error.error_msg}`);
    }
    return res.data.response.upload_url;
  };

  const uploadUrl = await getServer(targetId < 0);
  const buffer = await getImageBuffer(imageData);
  
  const form = new FormData();
  form.append('photo', buffer, { filename: 'photo.png' });

  const uploadRes = await axios.post(uploadUrl, form, { headers: form.getHeaders() });

  const saveParams: any = {
    access_token: accessToken,
    photo: uploadRes.data.photo,
    server: uploadRes.data.server,
    hash: uploadRes.data.hash,
    v: '5.131'
  };
  if (targetId < 0) saveParams.group_id = absId;

  const saveRes = await axios.get(`https://api.vk.com/method/photos.saveWallPhoto`, { params: saveParams });
  if (saveRes.data.error) throw new Error(`VK Save Photo: ${saveRes.data.error.error_msg}`);
  
  const photo = saveRes.data.response[0];
  return `photo${photo.owner_id}_${photo.id}`;
}

async function publishToVK(accessToken: string, ownerId: string, message: string, image?: string) {
  // Очистка ID. Если это группа, ID должен быть отрицательным.
  let cleanId = ownerId.trim().replace(/^(club|public|id|@)/i, '');
  let numericId = parseInt(cleanId, 10);
  
  if (isNaN(numericId)) throw new Error('ID должен быть числом');

  // Если используется токен группы, мы можем постить ТОЛЬКО в эту группу. 
  // Большинство ошибок "method is unavailable with group auth" происходят из-за того, что ID положительный (стена юзера).
  // Мы пробуем оба варианта: если ID не отрицательный, но это явно группа - инвертируем.
  if (numericId > 0 && (ownerId.includes('-') || /club|public/i.test(ownerId))) {
    numericId = -numericId;
  }

  let attachment = "";
  if (image) {
    try {
      attachment = await uploadPhotoToVK(accessToken, numericId, image);
    } catch (e) {
      console.error('VK Photo Error:', e);
      // Если фото не загрузилось, попробуем хотя бы текст
    }
  }

  const postParams = {
    access_token: accessToken,
    owner_id: numericId,
    from_group: numericId < 0 ? 1 : 0,
    message,
    attachments: attachment,
    v: '5.131'
  };

  const res = await axios.post(`https://api.vk.com/method/wall.post`, null, { params: postParams });

  if (res.data.error) {
    // Если ошибка "метод недоступен с токеном группы", возможно мы ошиблись с полярностью ID
    if (res.data.error.error_code === 15 || res.data.error.error_msg.includes('group auth')) {
      postParams.owner_id = -Math.abs(numericId); // Принудительно в группу
      postParams.from_group = 1;
      const retry = await axios.post(`https://api.vk.com/method/wall.post`, null, { params: postParams });
      if (retry.data.error) throw new Error(retry.data.error.error_msg);
      return { success: true };
    }
    throw new Error(res.data.error.error_msg);
  }

  return { success: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Not Allowed');
  const userId = req.headers.authorization?.replace('Bearer ', '');
  if (!userId) return res.status(401).send('Unauthorized');

  const { text, image } = req.body;
  const { data: accounts } = await supabase.from('target_accounts').select('*').eq('user_id', userId).eq('is_active', true);

  if (!accounts || accounts.length === 0) return res.json({ results: [] });

  const results = [];
  for (const acc of accounts) {
    try {
      if (acc.platform === 'Telegram') {
        const bot = new Telegraf(acc.credentials.botToken);
        // Исправляем ID: если это строка с цифрами, Telegraf может ее не понять как числовой ID
        const rawChatId = acc.credentials.chatId.trim();
        const chatId = /^-?\d+$/.test(rawChatId) ? parseInt(rawChatId, 10) : rawChatId;

        try {
          if (image) {
            const buffer = await getImageBuffer(image);
            await bot.telegram.sendPhoto(chatId, { source: buffer }, { caption: text.slice(0, 1024) });
            if (text.length > 1024) await bot.telegram.sendMessage(chatId, text);
          } else {
            await bot.telegram.sendMessage(chatId, text);
          }
        } catch (tgErr: any) {
          // Fallback: если не вышло с фото, шлем текст
          if (image) await bot.telegram.sendMessage(chatId, `⚠️ (Без фото) \n\n${text}`);
          else throw tgErr;
        }
        results.push({ name: acc.name, status: 'success' });
      } else if (acc.platform === 'VK') {
        await publishToVK(acc.credentials.accessToken, acc.credentials.ownerId, text, image);
        results.push({ name: acc.name, status: 'success' });
      } else {
        results.push({ name: acc.name, status: 'failed', error: 'Платформа пока не поддерживается' });
      }
    } catch (e: any) {
      results.push({ name: acc.name, status: 'failed', error: e.message });
    }
  }
  res.status(200).json({ results });
}
