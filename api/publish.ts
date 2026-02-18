
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';
import axios from 'axios';
import FormData from 'form-data';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

async function getImageBuffer(imageData: string): Promise<Buffer | null> {
  if (!imageData) return null;
  try {
    if (imageData.startsWith('data:image')) {
      return Buffer.from(imageData.split(',')[1], 'base64');
    } 
    if (imageData.startsWith('http')) {
      const response = await axios.get(imageData, { 
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      return Buffer.from(response.data);
    }
    return Buffer.from(imageData, 'base64');
  } catch (e: any) {
    throw new Error(`Ошибка изображения: ${e.message}`);
  }
}

async function publishToTelegram(botToken: string, chatId: string, text: string, image?: string) {
  const token = botToken.trim();
  const id = chatId.trim();
  
  try {
    const buffer = image ? await getImageBuffer(image) : null;

    if (buffer) {
      const form = new FormData();
      form.append('chat_id', id);
      form.append('caption', text || '');
      form.append('photo', buffer, { filename: 'image.png' });
      await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, form, {
        headers: form.getHeaders(),
        timeout: 25000
      });
    } else {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: id,
        text: text || ''
      }, {
        timeout: 25000
      });
    }
  } catch (err: any) {
    const errorMsg = err.response?.data?.description || err.message;
    throw new Error(`Telegram error: ${errorMsg}`);
  }
}

async function publishToVK(accessToken: string, ownerId: string, text: string, image?: string, previewOnly: boolean = false) {
  const token = accessToken.trim();
  const rawGroupId = ownerId.trim().replace(/\D/g, ''); 
  const targetId = `-${rawGroupId}`; 
  
  const vkPost = async (method: string, data: any) => {
    const fullParams = { ...data, access_token: token, v: '5.131' };
    try {
      const params = new URLSearchParams();
      for (const key in fullParams) params.append(key, String(fullParams[key]));
      const response = await axios.post(`https://api.vk.com/method/${method}`, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 25000
      });
      if (response.data.error) throw new Error(response.data.error.error_msg);
      return response.data.response;
    } catch (err: any) { throw err; }
  };

  let attachments = '';
  if (image) {
    try {
      const uploadServer = await vkPost('photos.getWallUploadServer', { group_id: rawGroupId });
      const buffer = await getImageBuffer(image);
      if (buffer) {
        const form = new FormData();
        form.append('photo', buffer, { filename: 'image.png' });
        const uploadRes = await axios.post(uploadServer.upload_url, form, { headers: form.getHeaders() });
        const saved = await vkPost('photos.saveWallPhoto', {
          group_id: rawGroupId,
          photo: uploadRes.data.photo,
          server: uploadRes.data.server,
          hash: uploadRes.data.hash
        });
        if (saved && saved.length > 0) attachments = `photo${saved[0].owner_id}_${saved[0].id}`;
      }
    } catch (e) {}
  }

  await vkPost('wall.post', { owner_id: targetId, from_group: 1, message: text || '', attachments });
}

async function publishToInstagram(accessToken: string, igUserId: string, text: string, image?: string, previewOnly: boolean = false) {
  const token = accessToken.trim();
  const userId = igUserId.trim();

  const igPost = async (endpoint: string, params: any) => {
    const url = `https://graph.facebook.com/v19.0/${endpoint}`;
    const response = await axios.post(url, { ...params, access_token: token }, { timeout: 30000 });
    return response.data;
  };

  try {
    const container = await igPost(`${userId}/media`, { image_url: image, caption: text });
    await new Promise(resolve => setTimeout(resolve, 7000));
    await igPost(`${userId}/media_publish`, { creation_id: container.id });
  } catch (e: any) {
    const msg = e.response?.data?.error?.message || e.message;
    throw new Error(`Instagram Error: ${msg}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Not Allowed');
  const userId = req.headers.authorization?.replace('Bearer ', '');
  if (!userId) return res.status(401).send('Unauthorized');

  const isPreview = req.query.preview === 'true';
  const { text, image, accountIds } = req.body;
  
  let query = supabase.from('target_accounts').select('*').eq('user_id', userId).eq('is_active', true);
  
  // Если переданы конкретные ID, выбираем только их
  if (accountIds && Array.isArray(accountIds) && accountIds.length > 0) {
    query = query.in('id', accountIds);
  }

  const { data: accounts } = await query;
  if (!accounts) return res.json({ results: [] });

  const results = [];
  for (const acc of accounts) {
    try {
      const p = acc.platform.toUpperCase();
      if (p === 'VK' || p === 'ВК') {
        await publishToVK(acc.credentials.accessToken, acc.credentials.ownerId, text, image, isPreview);
        results.push({ name: acc.name, status: 'success' });
      } else if (p === 'TELEGRAM' || p === 'ТЕЛЕГРАМ') {
        await publishToTelegram(acc.credentials.botToken, acc.credentials.chatId, text, image);
        results.push({ name: acc.name, status: 'success' });
      } else if (p === 'INSTAGRAM' || p === 'ИНСТАГРАМ') {
        const igUserId = acc.credentials.igUserId || acc.credentials.instagramId;
        await publishToInstagram(acc.credentials.accessToken, igUserId, text, image, isPreview);
        results.push({ name: acc.name, status: 'success' });
      } else {
        results.push({ name: acc.name, status: 'failed', error: 'Platform not implemented' });
      }
    } catch (e: any) {
      results.push({ name: acc.name, status: 'failed', error: e.message });
    }
  }
  res.status(200).json({ results });
}
