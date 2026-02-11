
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.status(410).json({ error: "Этот эндпоинт устарел. Логика ИИ перенесена на клиент." });
}
