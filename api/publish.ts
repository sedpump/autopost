
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
    const fullParams = {
      ...data,
      access_token: token,
      v: '5.131'
    };
    
    const fullUrl = `https://api.vk.com/method/${method}`;
    const rawRequestString = `METHOD: ${method}\nURL: ${fullUrl}\nPAYLOAD: ${JSON.stringify(fullParams, null, 2)}`;

    if (previewOnly && method === 'wall.post') {
      const err = new Error("PREVIEW_MODE") as any;
      err.debugData = { 
        request: rawRequestString, 
        response: "--- РЕЖИМ ПРЕДПРОСМОТРА ---" 
      };
      throw err;
    }

    try {
      const params = new URLSearchParams();
      for (const key in fullParams) {
        params.append(key, String(fullParams[key]));
      }

      const response = await axios.post(fullUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 25000
      });
      
      if (response.data.error) {
        const err = new Error(response.data.error.error_msg) as any;
        err.errorCode = response.data.error.error_code;
        err.debugData = {
          request: rawRequestString,
          response: JSON.stringify(response.data, null, 2)
        };
        throw err;
      }
      return response.data.response;
    } catch (err: any) {
      if (err.message === "PREVIEW_MODE") throw err;
      if (!err.debugData) {
        err.debugData = {
          request: rawRequestString,
          response: err.response?.data ? JSON.stringify(err.response.data, null, 2) : err.message
        };
      }
      throw err;
    }
  };

  let attachments = '';
  let photoLogs = [];

  if (image) {
    try {
      if (!previewOnly) {
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
          
          if (saved && saved.length > 0) {
            attachments = `photo${saved[0].owner_id}_${saved[0].id}`;
          }
        }
      } else {
        attachments = `photo12345_67890`;
      }
    } catch (e: any) {
      photoLogs.push(`Ошибка фото: ${e.message}`);
      console.error("VK Photo Step Failed, continuing to text post...", e.message);
    }
  }

  try {
    const postData: any = {
      owner_id: targetId,
      from_group: 1,
      message: text || ''
    };
    
    // Отправляем attachments только если они реально есть
    if (attachments) {
      postData.attachments = attachments;
    }
    
    await vkPost('wall.post', postData);
  } catch (e: any) {
    const finalErr = new Error(e.message) as any;
    finalErr.debugData = e.debugData;
    if (photoLogs.length > 0) finalErr.message += ` (Доп. ошибки: ${photoLogs.join(', ')})`;
    throw finalErr;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Not Allowed');
  const userId = req.headers.authorization?.replace('Bearer ', '');
  if (!userId) return res.status(401).send('Unauthorized');

  const isPreview = req.query.preview === 'true';
  const { text, image } = req.body;
  const { data: accounts } = await supabase.from('target_accounts').select('*').eq('user_id', userId).eq('is_active', true);

  if (!accounts) return res.json({ results: [] });

  const results = [];
  for (const acc of accounts) {
    try {
      const p = acc.platform.toUpperCase();
      if (p === 'VK' || p === 'ВК') {
        await publishToVK(acc.credentials.accessToken, acc.credentials.ownerId, text, image, isPreview);
        results.push({ name: acc.name, status: 'success' });
      } else if (p === 'TELEGRAM' || p === 'ТЕЛЕГРАМ') {
        if (!isPreview) await publishToTelegram(acc.credentials.botToken, acc.credentials.chatId, text, image);
        results.push({ name: acc.name, status: isPreview ? 'failed' : 'success', error: isPreview ? 'Превью не поддерживается' : undefined });
      }
    } catch (e: any) {
      results.push({ 
        name: acc.name, 
        status: 'failed', 
        error: e.message === "PREVIEW_MODE" ? "Режим предпросмотра" : e.message,
        debugData: e.debugData 
      });
    }
  }
  res.status(200).json({ results });
}
