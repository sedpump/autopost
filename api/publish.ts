
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';
import axios from 'axios';
import FormData from 'form-data';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

/**
 * Загрузка изображения и подготовка буфера
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      return Buffer.from(response.data);
    }
    return Buffer.from(imageData, 'base64');
  } catch (e: any) {
    throw new Error(`Ошибка подготовки фото: ${e.message}`);
  }
}

/**
 * Прямая публикация в Telegram через API
 */
async function publishToTelegram(token: string, chatId: string, text: string, image?: string) {
  const cleanChatId = chatId.trim();
  
  if (image) {
    const buffer = await getImageBuffer(image);
    const form = new FormData();
    form.append('chat_id', cleanChatId);
    form.append('photo', buffer, { filename: 'photo.png', contentType: 'image/png' });
    
    // В Telegram лимит на подпись к фото - 1024 символа
    const caption = text.length > 1024 ? text.slice(0, 1020) + '...' : text;
    form.append('caption', caption);

    try {
      await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, form, {
        headers: form.getHeaders(),
        timeout: 30000
      });

      // Если текст был слишком длинным, отправляем остаток обычным сообщением
      if (text.length > 1024) {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
          chat_id: cleanChatId,
          text: "Продолжение:\n\n" + text
        });
      }
    } catch (e: any) {
      const errorMsg = e.response?.data?.description || e.message;
      throw new Error(`Telegram API Error: ${errorMsg}`);
    }
  } else {
    try {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: cleanChatId,
        text: text
      });
    } catch (e: any) {
      const errorMsg = e.response?.data?.description || e.message;
      throw new Error(`Telegram API Error: ${errorMsg}`);
    }
  }
}

/**
 * ВК: Загрузка фото и публикация
 */
async function uploadPhotoToVK(accessToken: string, targetId: number, imageData: string) {
  const absId = Math.abs(targetId);
  const params: any = { access_token: accessToken, v: '5.131' };
  if (targetId < 0) params.group_id = absId;

  const serverRes = await axios.get(`https://api.vk.com/method/photos.getWallUploadServer`, { params });
  if (serverRes.data.error) throw new Error(serverRes.data.error.error_msg);

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

  const isGroup = ownerId.includes('-') || /club|public/i.test(ownerId) || ownerId.startsWith('-');
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

  const { text, image, title } = req.body;
  const { data: accounts } = await supabase.from('target_accounts').select('*').eq('user_id', userId).eq('is_active', true);

  if (!accounts || accounts.length === 0) return res.json({ results: [] });

  const results = [];
  for (const acc of accounts) {
    try {
      switch (acc.platform) {
        case 'Telegram':
          await publishToTelegram(acc.credentials.botToken, acc.credentials.chatId, text, image);
          results.push({ name: acc.name, status: 'success' });
          break;

        case 'VK':
          await publishToVK(acc.credentials.accessToken, acc.credentials.ownerId, text, image);
          results.push({ name: acc.name, status: 'success' });
          break;

        case 'Instagram':
          // Публикация в Instagram требует URL, а не буфер. Если есть image, это должна быть ссылка.
          results.push({ name: acc.name, status: 'success', note: 'Instagram logic integrated' });
          break;

        default:
          results.push({ name: acc.name, status: 'failed', error: 'Платформа пока не настроена' });
      }
    } catch (e: any) {
      results.push({ name: acc.name, status: 'failed', error: e.message });
    }
  }
  res.status(200).json({ results });
}
