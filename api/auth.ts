
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

  // Проверяем, есть ли такой пользователь
  let { data: user, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();

  // Если нет — создаем
  if (!user) {
    const { data: newUser, error: createError } = await supabase
      .from('profiles')
      .insert([{ username }])
      .select()
      .single();
    
    if (createError) return res.status(500).json({ error: createError.message });
    user = newUser;
  }

  // Возвращаем пользователя (id используем как простейший токен)
  return res.status(200).json({
    id: user.id,
    username: user.username,
    token: user.id 
  });
}
