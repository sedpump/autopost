
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
 * Загрузка изображения с имитацией браузера для обхода 403
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
        timeout: 20000,
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      });
      return Buffer.from(response.data);
    }
    return Buffer.from(imageData, 'base64');
  } catch (e: any) {
    throw new Error(`Image error: ${e.message}`);
  }
}

/**
 * Загрузка фото в ВК (с фиксом ошибки 27 для групп)
 */
async function uploadPhotoToVK(accessToken: string, targetId: number, imageData: string) {
  const absId = Math.abs(targetId);
  
  // Для групп ОБЯЗАТЕЛЬНО передавать group_id в getWallUploadServer
  const params: any = { access_token: accessToken, v: '5.131' };
  if (targetId < 0) params.group_id = absId;

  const serverRes = await axios.get(`https://api.vk.com/method/photos.getWallUploadServer`, { params });
  
  if (serverRes.data.error) {
    // Если ошибка 27, пробуем принудительно с group_id еще раз
    if (serverRes.data.error.error_code === 27 && !params.group_id) {
        params.group_id = absId;
        const retry = await axios.get(`https://api.vk.com/method/photos.getWallUploadServer`, { params });
        if (retry.data.error) throw new Error(retry.data.error.error_msg);
        serverRes.data = retry.data;
    } else {
        throw new Error(serverRes.data.error.error_msg);
    }
  }

  const uploadUrl = serverRes.data.response.upload_url;
  const buffer = await getImageBuffer(imageData);
  
  const form = new FormData();
  form.append('photo', buffer, { filename: 'photo.png', contentType: 'image/png' });

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
  if (saveRes.data.error) throw new Error(`VK Save Photo Error: ${saveRes.data.error.error_msg}`);
  
  const photo = saveRes.data.response[0];
  return `photo${photo.owner_id}_${photo.id}`;
}

async function publishToVK(accessToken: string, ownerId: string, message: string, image?: string) {
  const cleanId = ownerId.trim().replace(/^(club|public|id|@)/i, '');
  let numericId = parseInt(cleanId, 10);
  if (isNaN(numericId)) throw new Error('VK ID must be a number');

  // Определяем, группа это или нет
  const isGroup = ownerId.includes('-') || /club|public/i.test(ownerId);
  if (isGroup && numericId > 0) numericId = -numericId;

  let attachment = "";
  if (image) {
    try {
      attachment = await uploadPhotoToVK(accessToken, numericId, image);
    } catch (e: any) {
      console.error('VK Image Upload Failed:', e.message);
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
        const chatId = acc.credentials.chatId.trim();
        
        try {
          if (image) {
            const buffer = await getImageBuffer(image);
            await bot.telegram.sendPhoto(chatId, { source: buffer }, { caption: text.slice(0, 1024) });
            if (text.length > 1024) await bot.telegram.sendMessage(chatId, text);
          } else {
            await bot.telegram.sendMessage(chatId, text);
          }
        } catch (tgErr: any) {
          // Если проблема с картинкой (403/400), отправляем просто текст
          if (image && (tgErr.message.includes('403') || tgErr.message.includes('400'))) {
             await bot.telegram.sendMessage(chatId, `⚠️ (Изображение недоступно)\n\n${text}`);
          } else {
            throw tgErr;
          }
        }
        results.push({ name: acc.name, status: 'success' });

      } else if (acc.platform === 'VK') {
        await publishToVK(acc.credentials.accessToken, acc.credentials.ownerId, text, image);
        results.push({ name: acc.name, status: 'success' });
      }
    } catch (e: any) {
      results.push({ name: acc.name, status: 'failed', error: e.message });
    }
  }
  res.status(200).json({ results });
}
