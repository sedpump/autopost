
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
        contents: `Ты — арт-директор. Прочитай этот текст и создай ОДНО детальное описание для генерации ИДЕАЛЬНОЙ обложки к посту. 
        Описание должно быть на английском, включать стиль (photorealistic, 3D render, digital art), освещение и ключевые объекты. 
        Избегай текста на картинке.
        Текст поста: ${text}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              keywords: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Массив из одной строки с полным описанием визуальной сцены"
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
            parts: [{ text: `High-quality social media content, professional aesthetics: ${prompt}. No text, no letters, cinematic, highly detailed.` }] 
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
        throw new Error("Модель не вернула изображение.");
      } catch (innerError: any) {
        console.error("Pro Image Generation Error:", innerError);
        return res.status(500).json({ error: "Ошибка генерации: " + innerError.message });
      }
    }

    res.status(400).json({ error: "Неизвестная задача" });
  } catch (error: any) {
    console.error("AI API Error:", error);
    res.status(500).json({ error: error.message });
  }
}
