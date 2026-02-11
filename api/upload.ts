
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const userId = auth.replace('Bearer ', '');

  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Image data required' });

  try {
    // Извлекаем чистый base64 и тип контента
    const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
    const contentType = mimeMatch ? mimeMatch[1] : 'image/png';
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Создаем путь: папка пользователя / таймстамп
    const fileName = `${userId}/${Date.now()}.png`;

    // ЗАГРУЖАЕМ В БАКЕТ 'Images' (С БОЛЬШОЙ БУКВЫ, КАК НА СКРИНШОТЕ)
    const { data, error } = await supabase.storage
      .from('Images')
      .upload(fileName, buffer, {
        contentType: contentType,
        upsert: true
      });

    if (error) {
      console.error('Supabase Storage Error:', error);
      throw new Error(`Storage error: ${error.message}. Проверьте, что бакет 'Images' (с большой буквы) существует.`);
    }

    // Получаем публичную ссылку
    const { data: { publicUrl } } = supabase.storage
      .from('Images')
      .getPublicUrl(fileName);

    return res.status(200).json({ url: publicUrl });
  } catch (err: any) {
    console.error('Upload handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
