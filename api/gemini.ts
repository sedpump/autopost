
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { task, payload } = req.body;
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API_KEY не найден в переменных окружения Vercel." });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    if (task === 'rewrite') {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Сгенерируй 3 разных варианта поста для соцсетей на основе этой статьи. ТЕКСТ ДОЛЖЕН БЫТЬ СТРОГО НА РУССКОМ ЯЗЫКЕ.
        Вариант 1: Профессиональный, экспертный и информативный тон. 
        Вариант 2: Виральный, вовлекающий, креативный с эмодзи. 
        Вариант 3: Короткий дайджест.
        Статья: ${payload.text}`,
        config: { 
          temperature: 0.8,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              variants: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    content: { type: Type.STRING }
                  },
                  required: ["title", "content"]
                }
              }
            },
            required: ["variants"]
          }
        },
      });
      return res.status(200).json(JSON.parse(response.text));
    }

    if (task === 'vision') {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Проанализируй текст и создай ОДИН детальный английский промпт для генерации картинки. 
        Стиль: современная цифровая иллюстрация, коммерческий арт. 
        БЕЗ ТЕКСТА НА КАРТИНКЕ.
        Текст: ${payload.text}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prompt: { type: Type.STRING, description: "Detailed English image generation prompt" }
            },
            required: ["prompt"]
          }
        }
      });
      return res.status(200).json(JSON.parse(response.text));
    }

    if (task === 'image') {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { 
          parts: [{ text: `High-quality commercial illustration, clean lines, professional lighting, 4k resolution, cinematic composition. Subject: ${payload.prompt}` }] 
        },
        config: { 
          imageConfig: { aspectRatio: "16:9" } 
        }
      });

      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (part?.inlineData) {
        return res.status(200).json({ base64: part.inlineData.data });
      }
      throw new Error("Модель не вернула данные изображения. Возможно, сработали фильтры безопасности.");
    }

    return res.status(400).json({ error: "Unknown task" });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
