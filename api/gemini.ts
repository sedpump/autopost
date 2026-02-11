
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { task, payload } = req.body;
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API_KEY не настроен." });
  }

  // Очистка текста от символов, которые могут вызвать сбой парсинга на стороне Google
  const cleanText = (text: string) => text ? text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "").trim() : "";

  const ai = new GoogleGenAI({ apiKey });

  try {
    if (task === 'rewrite') {
      const input = cleanText(payload.text);
      if (!input) throw new Error("Пустой текст для обработки");

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Сгенерируй 3 разных варианта поста для соцсетей на основе этой статьи. ТЕКСТ ДОЛЖЕН БЫТЬ СТРОГО НА РУССКОМ ЯЗЫКЕ.
        Вариант 1: Профессиональный стиль.
        Вариант 2: Креативный стиль с эмодзи.
        Вариант 3: Краткий дайджест.
        Статья: ${input}`,
        config: { 
          temperature: 0.7,
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
      const input = cleanText(payload.text);
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Create a professional English image generation prompt for this text: ${input}. Focus on conceptual digital art style, no text.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prompt: { type: Type.STRING }
            },
            required: ["prompt"]
          }
        }
      });
      return res.status(200).json(JSON.parse(response.text));
    }

    if (task === 'image') {
      const prompt = cleanText(payload.prompt);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { 
          parts: [{ text: `Professional commercial illustration, high quality, cinematic. Subject: ${prompt}` }] 
        },
        config: { 
          imageConfig: { aspectRatio: "16:9" } 
        }
      });

      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (part?.inlineData) {
        return res.status(200).json({ base64: part.inlineData.data });
      }
      throw new Error("Google Image Model did not return data. Try a different prompt.");
    }

    return res.status(400).json({ error: "Unknown task" });
  } catch (error: any) {
    // Если ошибка - это объект с кодом, вытаскиваем только сообщение
    let message = error.message;
    try {
      const parsed = JSON.parse(error.message);
      if (parsed.error?.message) message = parsed.error.message;
    } catch(e) {}
    
    console.error("Gemini Critical Error:", message);
    return res.status(500).json({ error: message });
  }
}
