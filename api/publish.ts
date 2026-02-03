
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

async function publishToTelegram(token: string, chatId: string, text: string, image?: string) {
  const botApiUrl = `https://api.telegram.org/bot${token.trim()}`;
  try {
    if (image) {
      const buffer = await getImageBuffer(image);
      if (buffer) {
        const form = new FormData();
        form.append('chat_id', chatId.trim());
        form.append('photo', buffer, { filename: 'post.png' });
        form.append('caption', text.slice(0, 1024));
        await axios.post(`${botApiUrl}/sendPhoto`, form, { headers: form.getHeaders(), timeout: 30000 });
        return;
      }
    }
    await axios.post(`${botApiUrl}/sendMessage`, { chat_id: chatId.trim(), text });
  } catch (e: any) {
    throw new Error(`TG: ${e.response?.data?.description || e.message}`);
  }
}

async function publishToVK(accessToken: string, ownerId: string, text: string, image?: string) {
  const token = accessToken.trim();
  const rawGroupId = ownerId.trim().replace(/\D/g, '');
  const targetId = `-${rawGroupId}`;
  
  const vkPost = async (method: string, data: any) => {
    const params = new URLSearchParams();
    for (const key in data) params.append(key, data[key]);
    params.append('access_token', token);
    params.append('v', '5.131');
    
    const fullUrl = `https://api.vk.com/method/${method}`;
    
    // ЭТО ТО, ЧТО НУЖНО ПОДДЕРЖКЕ (выводится в Logs Vercel)
    console.log(`--- [VK COMMAND START] ---`);
    console.log(`METHOD: POST`);
    console.log(`URL: ${fullUrl}`);
    console.log(`PARAMS:`, params.toString());
    console.log(`--- [VK COMMAND END] ---`);
    
    try {
      const response = await axios.post(fullUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 25000
      });
      
      console.log(`[VK RESPONSE] Full JSON:`, JSON.stringify(response.data));

      if (response.data.error) {
        const { error_code, error_msg } = response.data.error;
        throw new Error(`VK Error ${error_code}: ${error_msg}`);
      }
      return response.data.response;
    } catch (err: any) {
      const errDetail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.error(`[VK CRITICAL ERROR]:`, errDetail);
      throw new Error(`ВК: ${errDetail}`);
    }
  };

  try {
    let attachments = '';
    if (image) {
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
        if (saved?.length) attachments = `photo${saved[0].owner_id}_${saved[0].id}`;
      }
    }

    // Финальный вызов публикации
    await vkPost('wall.post', {
      owner_id: targetId,
      from_group: 1,
      message: text,
      attachments: attachments
    });
  } catch (e: any) {
    throw new Error(e.message || 'Ошибка ВК');
  }
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
      const p = acc.platform.toUpperCase();
      if (p === 'VK' || p === 'ВК') {
        await publishToVK(acc.credentials.accessToken, acc.credentials.ownerId, text, image);
        results.push({ name: acc.name, status: 'success' });
      } else if (p === 'TELEGRAM' || p === 'ТЕЛЕГРАМ') {
        await publishToTelegram(acc.credentials.botToken, acc.credentials.chatId, text, image);
        results.push({ name: acc.name, status: 'success' });
      }
    } catch (e: any) {
      results.push({ name: acc.name, status: 'failed', error: e.message });
    }
  }
  res.status(200).json({ results });
}
