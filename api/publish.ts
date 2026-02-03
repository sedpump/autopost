
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
 * Получение буфера изображения с имитацией браузера.
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
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
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
  const cleanToken = token.trim();
  const cleanChatId = chatId.trim();
  const botApiUrl = `https://api.telegram.org/bot${cleanToken}`;

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
          timeout: 40000
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
 * Публикация во ВКонтакте (через API wall.post).
 */
async function publishToVK(accessToken: string, ownerId: string, text: string, image?: string) {
  const token = accessToken.trim();
  // VK требует, чтобы ID группы был отрицательным
  let targetId = ownerId.trim();
  if (!targetId.startsWith('-') && targetId.length > 5) {
    targetId = `-${targetId}`;
  }
  
  const vkApi = (method: string, params: any) => 
    axios.get(`https://api.vk.com/method/${method}`, {
      params: { ...params, access_token: token, v: '5.131' }
    });

  try {
    let attachments = '';

    if (image) {
      const buffer = await getImageBuffer(image);
      if (buffer) {
        // 1. Получаем сервер для загрузки
        const uploadServerRes = await vkApi('photos.getWallUploadServer', {
          group_id: Math.abs(parseInt(targetId))
        });
        
        if (uploadServerRes.data.error) throw new Error(uploadServerRes.data.error.error_msg);
        const uploadUrl = uploadServerRes.data.response.upload_url;

        // 2. Загружаем файл
        const form = new FormData();
        form.append('photo', buffer, { filename: 'image.png' });
        const uploadRes = await axios.post(uploadUrl, form, { headers: form.getHeaders() });

        // 3. Сохраняем фото
        const saveRes = await vkApi('photos.saveWallPhoto', {
          group_id: Math.abs(parseInt(targetId)),
          photo: uploadRes.data.photo,
          server: uploadRes.data.server,
          hash: uploadRes.data.hash
        });

        if (saveRes.data.error) throw new Error(saveRes.data.error.error_msg);
        const photo = saveRes.data.response[0];
        attachments = `photo${photo.owner_id}_${photo.id}`;
      }
    }

    // 4. Публикуем пост
    const postRes = await vkApi('wall.post', {
      owner_id: targetId,
      message: text,
      attachments: attachments
    });

    if (postRes.data.error) throw new Error(postRes.data.error.error_msg);

  } catch (e: any) {
    throw new Error(`VK: ${e.message}`);
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
      results.push({ name: acc.name, status: 'failed', error: e.message });
    }
  }
  res.status(200).json({ results });
}
