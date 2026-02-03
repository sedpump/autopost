
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  
  // В нашей схеме token — это просто id пользователя
  const userId = auth.replace('Bearer ', '');

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('sources')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { url } = req.body;
    const cleanUrl = url.startsWith('@') ? url : `@${url}`;

    const { data, error } = await supabase
      .from('sources')
      .insert([{ 
        user_id: userId, 
        url: cleanUrl
      }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    const { error } = await supabase
      .from('sources')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // Защита: удаляем только своё

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).send('Method Not Allowed');
}
