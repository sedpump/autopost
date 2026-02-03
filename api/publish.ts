
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
 * Получение буфера изображения с жестким таймаутом.
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
        timeout: 5000, // Если за 5 секунд не скачалось - пропускаем фото
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      return Buffer.from(response.data);
    }
    return Buffer.from(imageData, 'base64');
  } catch (e) {
    console.error('Image buffer failed:', e);
    return null; // Возвращаем null, чтобы сработал fallback на текст
  }
}

/**
 * Исправленная функция отправки в Telegram
 */
async function publishToTelegram(token: string, chatId: string, text: string, image?: string) {
  if (!token || !chatId) throw new Error("Токен или ID чата отсутствуют в настройках аккаунта");

  // Авто-форматирование chatId
  let targetChatId = chatId.trim();
  
  // 1. Если это не число и нет @ - добавляем @ (для публичных каналов)
  if (!targetChatId.startsWith('@') && !targetChatId.startsWith('-') && isNaN(Number(targetChatId))) {
    targetChatId = `@${targetChatId}`;
  }
  
  // 2. Если это число и похоже на ID канала (начинается с 100), но нет минуса
  if (/^100\d+$/.test(targetChatId)) {
    targetChatId = `-100${targetChatId}`;
  }

  const botApiUrl = `https://api.telegram.org/bot${token.trim()}`;

  // Пытаемся отправить с фото
  if (image) {
    const buffer = await getImageBuffer(image);
    if (buffer) {
      try {
        const form = new FormData();
        form.append('chat_id', targetChatId);
        form.append('photo', buffer, { filename: 'post.png' });
        
        // Лимит 1024 для подписи
        const caption = text.length > 1024 ? text.slice(0, 1020) + '...' : text;
        form.append('caption', caption);

        await axios.post(`${botApiUrl}/sendPhoto`, form, {
          headers: form.getHeaders(),
          timeout: 20000
        });

        if (text.length > 1024) {
          await axios.post(`${botApiUrl}/sendMessage`, {
            chat_id: targetChatId,
            text: "📝 Продолжение:\n\n" + text
          });
        }
        return { success: true };
      } catch (e: any) {
        console.warn('Photo failed, falling back to text:', e.response?.data || e.message);
        // Если ошибка в самом chatId, выбрасываем её сразу
        if (e.response?.data?.description?.includes('chat not found')) {
           throw new Error(`Telegram: Канал/чат "${targetChatId}" не найден. Проверьте ID и добавлен ли туда бот.`);
        }
      }
    }
  }

  // Fallback: отправка чистого текста
  try {
    await axios.post(`${botApiUrl}/sendMessage`, {
      chat_id: targetChatId,
      text: text
    });
    return { success: true };
  } catch (e: any) {
    const errorMsg = e.response?.data?.description || e.message;
    throw new Error(`Telegram API Error: ${errorMsg}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Not Allowed');
  const userId = req.headers.authorization?.replace('Bearer ', '');
  if (!userId) return res.status(401).send('Unauthorized');

  const { text, image } = req.body;
  const { data: accounts } = await supabase
    .from('target_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!accounts || accounts.length === 0) return res.json({ results: [] });

  const results = [];
  for (const acc of accounts) {
    try {
      if (acc.platform === 'Telegram') {
        await publishToTelegram(acc.credentials.botToken, acc.credentials.chatId, text, image);
        results.push({ name: acc.name, status: 'success' });
      } else {
        // Другие платформы не трогаем по просьбе пользователя
        results.push({ name: acc.name, status: 'idle', note: 'Пропущено (фокус на ТГ)' });
      }
    } catch (e: any) {
      results.push({ name: acc.name, status: 'failed', error: e.message });
    }
  }
  res.status(200).json({ results });
}
