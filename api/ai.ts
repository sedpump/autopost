
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { task, text, prompt } = req.body;

  if (!process.env.API_KEY) {
    return res.status(500).json({ error: "API_KEY не настроен на сервере." });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    if (task === 'rewrite') {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Сгенерируй 3 разных варианта поста для соцсетей на основе этой статьи. ТЕКСТ ДОЛЖЕН БЫТЬ СТРОГО НА РУССКОМ ЯЗЫКЕ.
        Вариант 1: Профессиональный, экспертный и информативный тон. 
        Вариант 2: Виральный, вовлекающий, креативный с эмодзи и призывами к действию. 
        Вариант 3: Ультра-короткий, формат "главное за 30 секунд".
        Статья: ${text}`,
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
      return res.status(200).json(JSON.parse(response.text || '{"variants":[]}'));
    }

    if (task === 'keywords') {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Выдели 3 ключевых визуальных образа (на английском языке) для генерации качественной картинки к этому тексту. Ответ верни в формате JSON массива строк. Текст: ${text}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              keywords: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING } 
              }
            },
            required: ["keywords"]
          }
        }
      });
      return res.status(200).json(JSON.parse(response.text?.trim() || '{"keywords":[]}'));
    }

    if (task === 'image') {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: { 
            parts: [{ text: `A high-end, professional commercial 3D render illustration for a social media post about: ${prompt}. Cinematic lighting, minimalist style, sharp focus, 8k resolution, clean modern aesthetic.` }] 
          },
          config: { 
            imageConfig: { 
              aspectRatio: "16:9",
              imageSize: "1K" 
            } 
          }
        });

        const candidates = response.candidates || [];
        if (candidates.length > 0) {
          for (const part of candidates[0].content.parts) {
            if (part.inlineData) {
              return res.status(200).json({ url: `data:image/png;base64,${part.inlineData.data}` });
            }
          }
        }
        throw new Error("Модель не вернула данные изображения.");
      } catch (innerError: any) {
        console.error("Pro Image Generation Error:", innerError);
        return res.status(500).json({ error: "Ошибка генерации Pro Image: " + innerError.message });
      }
    }

    res.status(400).json({ error: "Неизвестная задача" });
  } catch (error: any) {
    console.error("AI API Error:", error);
    res.status(500).json({ error: error.message });
  }
}
