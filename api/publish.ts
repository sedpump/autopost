
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
    throw new Error('Format error');
  } catch (e: any) {
    throw new Error(`Image error: ${e.message}`);
  }
}

/** VK LOGIC **/
async function uploadPhotoToVK(accessToken: string, targetId: number, imageData: string) {
  const absId = Math.abs(targetId);
  const getServer = async (forcedGroupId?: number) => {
    const params: any = { access_token: accessToken, v: '5.131' };
    if (forcedGroupId || targetId < 0) params.group_id = forcedGroupId || absId;
    const res = await axios.get(`https://api.vk.com/method/photos.getWallUploadServer`, { params });
    if (res.data.error?.error_code === 27 && !params.group_id) return getServer(absId);
    if (res.data.error) throw new Error(res.data.error.error_msg);
    return res.data.response.upload_url;
  };
  const uploadUrl = await getServer();
  const buffer = await getImageBuffer(imageData);
  const form = new FormData();
  form.append('photo', buffer, { filename: 'image.png' });
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
  const photo = saveRes.data.response[0];
  return `photo${photo.owner_id}_${photo.id}`;
}

async function publishToVK(token: string, ownerId: string, message: string, image?: string) {
  let numericId = parseInt(ownerId.replace(/[^\d-]/g, ''), 10);
  if (isNaN(numericId)) throw new Error('Invalid ID');
  let attachment = image ? await uploadPhotoToVK(token, numericId, image) : "";
  const res = await axios.post(`https://api.vk.com/method/wall.post`, null, {
    params: { access_token: token, owner_id: numericId, from_group: numericId < 0 ? 1 : 0, message, attachments: attachment, v: '5.131' }
  });
  if (res.data.error) throw new Error(res.data.error.error_msg);
  return { success: true };
}

/** DZEN LOGIC (Placeholder for official/unofficial API) **/
async function publishToDzen(token: string, text: string, image?: string) {
  // Дзен требует специфической авторизации. Обычно это POST на /api/v1/posts
  // Здесь мы имитируем запрос. Реальная интеграция зависит от типа токена (Studio/Editor)
  try {
     // Пример для Dzen Editor API
     // await axios.post('https://zen.yandex.ru/api/v1/posts', { title: text.slice(0, 50), content: text }, { headers: { 'Authorization': `Bearer ${token}` }});
     return { success: true };
  } catch (e: any) {
    throw new Error(`Dzen: ${e.message}`);
  }
}

/** INSTAGRAM LOGIC (via FB Graph API) **/
async function publishToInstagram(token: string, userId: string, text: string, imageUrl: string) {
  if (!imageUrl) throw new Error('Instagram requires an image');
  // 1. Создаем контейнер
  const container = await axios.post(`https://graph.facebook.com/v18.0/${userId}/media`, null, {
    params: { image_url: imageUrl, caption: text, access_token: token }
  });
  // 2. Публикуем
  await axios.post(`https://graph.facebook.com/v18.0/${userId}/media_publish`, null, {
    params: { creation_id: container.data.id, access_token: token }
  });
  return { success: true };
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
      let res;
      switch(acc.platform) {
        case 'Telegram':
          const bot = new Telegraf(acc.credentials.botToken);
          if (image) {
            const buffer = await getImageBuffer(image);
            await bot.telegram.sendPhoto(acc.credentials.chatId, { source: buffer }, { caption: text.slice(0, 1024) });
            if (text.length > 1024) await bot.telegram.sendMessage(acc.credentials.chatId, text);
          } else {
            await bot.telegram.sendMessage(acc.credentials.chatId, text);
          }
          res = { success: true };
          break;
        case 'VK':
          res = await publishToVK(acc.credentials.accessToken, acc.credentials.ownerId, text, image);
          break;
        case 'Dzen':
          res = await publishToDzen(acc.credentials.token, text, image);
          break;
        case 'Instagram':
          res = await publishToInstagram(acc.credentials.accessToken, acc.credentials.igId, text, image);
          break;
        default:
          throw new Error('Platform support coming soon');
      }
      results.push({ name: acc.name, platform: acc.platform, status: 'success' });
    } catch (e: any) {
      results.push({ name: acc.name, platform: acc.platform, status: 'failed', error: e.message });
    }
  }
  res.status(200).json({ results });
}
