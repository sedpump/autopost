
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
 * Загрузка изображения с таймаутом и проверкой
 */
async function getImageBuffer(imageData: string): Promise<Buffer> {
  try {
    if (imageData.startsWith('data:image')) {
      return Buffer.from(imageData.split(',')[1], 'base64');
    } else if (imageData.startsWith('http')) {
      const response = await axios.get(imageData, { 
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 OmniPost/1.0' }
      });
      return Buffer.from(response.data);
    }
    throw new Error('Некорректный формат изображения');
  } catch (e: any) {
    throw new Error(`Ошибка загрузки изображения: ${e.message}`);
  }
}

/**
 * Универсальная загрузка фото в ВК (поддерживает и ключи пользователей, и ключи групп)
 */
async function uploadPhotoToVK(accessToken: string, targetId: number, imageData: string) {
  const absId = Math.abs(targetId);
  
  // Пытаемся получить сервер. Если targetId < 0, сразу шлем group_id.
  const getServer = async (forcedGroupId?: number) => {
    const params: any = { access_token: accessToken, v: '5.131' };
    if (forcedGroupId) params.group_id = forcedGroupId;
    else if (targetId < 0) params.group_id = absId;

    const res = await axios.get(`https://api.vk.com/method/photos.getWallUploadServer`, { params });
    
    // Если получили ошибку 27, значит это токен группы и нужен group_id (даже если мы его не слали)
    if (res.data.error?.error_code === 27 && !params.group_id) {
      return getServer(absId); 
    }
    
    if (res.data.error) throw new Error(`${res.data.error.error_msg} (код ${res.data.error.error_code})`);
    return res.data.response.upload_url;
  };

  const uploadUrl = await getServer();

  // Загружаем файл
  const buffer = await getImageBuffer(imageData);
  const form = new FormData();
  form.append('photo', buffer, { filename: 'post.png' });

  const uploadRes = await axios.post(uploadUrl, form, { 
    headers: form.getHeaders(),
    timeout: 20000 
  });

  // Сохраняем фото
  const saveParams: any = {
    access_token: accessToken,
    photo: uploadRes.data.photo,
    server: uploadRes.data.server,
    hash: uploadRes.data.hash,
    v: '5.131'
  };
  
  if (targetId < 0) saveParams.group_id = absId;

  const saveRes = await axios.get(`https://api.vk.com/method/photos.saveWallPhoto`, { params: saveParams });

  if (saveRes.data.error) {
    // Еще одна попытка с group_id если не сработало
    if (saveRes.data.error.error_code === 27 && !saveParams.group_id) {
        saveParams.group_id = absId;
        const retrySave = await axios.get(`https://api.vk.com/method/photos.saveWallPhoto`, { params: saveParams });
        if (retrySave.data.error) throw new Error(retrySave.data.error.error_msg);
        const photo = retrySave.data.response[0];
        return `photo${photo.owner_id}_${photo.id}`;
    }
    throw new Error(saveRes.data.error.error_msg);
  }

  const photo = saveRes.data.response[0];
  return `photo${photo.owner_id}_${photo.id}`;
}

async function publishToVK(accessToken: string, ownerId: string, message: string, image?: string) {
  let cleanId = ownerId.trim().toLowerCase().replace('id', '').replace('club', '').replace('public', '');
  let numericId = parseInt(cleanId, 10);
  if (isNaN(numericId)) throw new Error('ID должен быть числом');

  // Если это группа (число было с минусом или содержало club/public), гарантируем минус
  const isGroup = ownerId.includes('-') || ownerId.includes('club') || ownerId.includes('public');
  if (isGroup && numericId > 0) numericId = -numericId;

  let attachment = "";
  let warn = "";

  if (image) {
    try {
      attachment = await uploadPhotoToVK(accessToken, numericId, image);
    } catch (e: any) {
      warn = ` (Пост без фото: ${e.message})`;
    }
  }

  const res = await axios.post(`https://api.vk.com/method/wall.post`, null, {
    params: {
      access_token: accessToken,
      owner_id: numericId,
      from_group: numericId < 0 ? 1 : 0,
      message,
      attachments: attachment,
      v: '5.131'
    }
  });

  if (res.data.error) throw new Error(res.data.error.error_msg);
  return warn ? { partial: true, error: warn } : { success: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Not Allowed');
  const userId = req.headers.authorization?.replace('Bearer ', '');
  if (!userId) return res.status(401).send('Unauthorized');

  const { text, image } = req.body;
  const { data: accounts } = await supabase.from('target_accounts').select('*').eq('user_id', userId).eq('is_active', true);
  if (!accounts) return res.json({ results: [] });

  const results = [];
  for (const acc of accounts) {
    try {
      if (acc.platform === 'Telegram') {
        const bot = new Telegraf(acc.credentials.botToken);
        const chatId = acc.credentials.chatId;
        if (image) {
          const buffer = await getImageBuffer(image);
          await bot.telegram.sendPhoto(chatId, { source: buffer }, { caption: text.slice(0, 1024) });
          if (text.length > 1024) await bot.telegram.sendMessage(chatId, text);
        } else {
          await bot.telegram.sendMessage(chatId, text);
        }
        results.push({ name: acc.name, status: 'success' });
      } else if (acc.platform === 'VK') {
        const vkRes = await publishToVK(acc.credentials.accessToken, acc.credentials.ownerId, text, image);
        results.push({ name: acc.name, status: vkRes.partial ? 'failed' : 'success', error: vkRes.error });
      }
    } catch (e: any) {
      results.push({ name: acc.name, status: 'failed', error: e.message });
    }
  }
  res.status(200).json({ results });
}
