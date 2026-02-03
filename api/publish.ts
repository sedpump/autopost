
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
 * Получение буфера изображения.
 */
async function getImageBuffer(imageData: string): Promise<Buffer | null> {
  if (!imageData) return null;
  try {
    if (imageData.startsWith('data:image')) {
      const base64Data = imageData.split(',')[1];
      return Buffer.from(base64Data, 'base64');
    } 
    if (imageData.startsWith('http')) {
      const response = await axios.get(imageData, { 
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      return Buffer.from(response.data);
    }
    return Buffer.from(imageData, 'base64');
  } catch (e: any) {
    console.error('Image processing failed:', e.message);
    return null;
  }
}

/**
 * Публикация в Telegram.
 */
async function publishToTelegram(token: string, chatId: string, text: string, image?: string) {
  const botApiUrl = `https://api.telegram.org/bot${token.trim()}`;
  const cleanChatId = chatId.trim();

  try {
    if (image) {
      const buffer = await getImageBuffer(image);
      if (buffer) {
        const form = new FormData();
        form.append('chat_id', cleanChatId);
        form.append('photo', buffer, { filename: 'post.png' });
        const caption = text.length > 1024 ? text.slice(0, 1020) + '...' : text;
        form.append('caption', caption);

        await axios.post(`${botApiUrl}/sendPhoto`, form, {
          headers: form.getHeaders(),
          timeout: 30000
        });

        if (text.length > 1024) {
          await axios.post(`${botApiUrl}/sendMessage`, { chat_id: cleanChatId, text: text });
        }
        return;
      }
    }
    await axios.post(`${botApiUrl}/sendMessage`, { chat_id: cleanChatId, text: text });
  } catch (e: any) {
    const tgError = e.response?.data?.description || e.message;
    throw new Error(`Telegram: ${tgError}`);
  }
}

/**
 * Публикация во ВКонтакте (через POST и URLSearchParams).
 */
async function publishToVK(accessToken: string, ownerId: string, text: string, image?: string) {
  const token = accessToken.trim();
  let targetId = ownerId.trim();
  
  // VK требует, чтобы ID группы был отрицательным для owner_id
  if (!targetId.startsWith('-')) {
    targetId = `-${targetId}`;
  }
  
  const vkPost = async (method: string, data: any) => {
    const params = new URLSearchParams();
    for (const key in data) {
      params.append(key, data[key]);
    }
    params.append('access_token', token);
    params.append('v', '5.131');
    
    const response = await axios.post(`https://api.vk.com/method/${method}`, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000
    });
    
    if (response.data.error) {
      const { error_code, error_msg } = response.data.error;
      throw new Error(`VK Error ${error_code}: ${error_msg}`);
    }
    return response.data.response;
  };

  try {
    let attachments = '';

    if (image) {
      const buffer = await getImageBuffer(image);
      if (buffer) {
        // 1. Получаем сервер
        const uploadServer = await vkPost('photos.getWallUploadServer', {
          group_id: Math.abs(parseInt(targetId))
        });
        
        // 2. Загружаем файл
        const form = new FormData();
        form.append('photo', buffer, { filename: 'image.png' });
        const uploadRes = await axios.post(uploadServer.upload_url, form, { 
          headers: form.getHeaders(),
          timeout: 20000 
        });

        // 3. Сохраняем фото
        const savedPhotos = await vkPost('photos.saveWallPhoto', {
          group_id: Math.abs(parseInt(targetId)),
          photo: uploadRes.data.photo,
          server: uploadRes.data.server,
          hash: uploadRes.data.hash
        });

        if (savedPhotos && savedPhotos.length > 0) {
          const photo = savedPhotos[0];
          attachments = `photo${photo.owner_id}_${photo.id}`;
        }
      }
    }

    // 4. Публикуем пост (обязательно с from_group: 1)
    await vkPost('wall.post', {
      owner_id: targetId,
      from_group: 1,
      message: text,
      attachments: attachments
    });

  } catch (e: any) {
    throw new Error(e.message);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Not Allowed');
  const userId = req.headers.authorization?.replace('Bearer ', '');
  if (!userId) return res.status(401).send('Unauthorized');

  const { text, image } = req.body;
  
  const { data: accounts, error: accError } = await supabase
    .from('target_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (accError) return res.status(500).json({ error: accError.message });
  if (!accounts || accounts.length === 0) return res.json({ results: [] });

  const results = [];
  // Обрабатываем последовательно, чтобы избежать Race Condition и лимитов API
  for (const acc of accounts) {
    try {
      if (acc.platform === 'Telegram') {
        await publishToTelegram(acc.credentials.botToken, acc.credentials.chatId, text, image);
        results.push({ name: acc.name, status: 'success' });
      } else if (acc.platform === 'VK') {
        await publishToVK(acc.credentials.accessToken, acc.credentials.ownerId, text, image);
        results.push({ name: acc.name, status: 'success' });
      } else {
        results.push({ name: acc.name, status: 'failed', error: 'Платформа пока в разработке' });
      }
    } catch (e: any) {
      console.error(`Error publishing to ${acc.name}:`, e.message);
      results.push({ name: acc.name, status: 'failed', error: e.message });
    }
  }
  res.status(200).json({ results });
}
