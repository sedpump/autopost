
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
        timeout: 10000
      });
      return Buffer.from(response.data);
    }
    return Buffer.from(imageData, 'base64');
  } catch (e) {
    console.error('Image buffer failed:', e);
    return null;
  }
}

/**
 * Чистая функция отправки в Telegram через Axios.
 * Никакой магии с ID, только trim.
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
        
        // Лимит 1024 для подписи к фото
        const caption = text.length > 1024 ? text.slice(0, 1020) + '...' : text;
        form.append('caption', caption);

        await axios.post(`${botApiUrl}/sendPhoto`, form, {
          headers: form.getHeaders(),
          timeout: 30000
        });

        // Если текст длинный, досылаем остаток вторым сообщением
        if (text.length > 1024) {
          await axios.post(`${botApiUrl}/sendMessage`, {
            chat_id: cleanChatId,
            text: text
          });
        }
        return;
      }
    }

    // Если нет картинки или она не загрузилась — шлем чистый текст
    await axios.post(`${botApiUrl}/sendMessage`, {
      chat_id: cleanChatId,
      text: text
    });

  } catch (e: any) {
    // Вытаскиваем детальное описание ошибки от Telegram (например "chat not found")
    const tgError = e.response?.data?.description || e.message;
    throw new Error(`Telegram: ${tgError}`);
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
        await publishToTelegram(
          acc.credentials.botToken, 
          acc.credentials.chatId, 
          text, 
          image
        );
        results.push({ name: acc.name, status: 'success' });
      } else {
        // Другие платформы не трогаем по просьбе пользователя
        results.push({ name: acc.name, status: 'idle', note: 'Focus on Telegram' });
      }
    } catch (e: any) {
      results.push({ name: acc.name, status: 'failed', error: e.message });
    }
  }
  res.status(200).json({ results });
}
