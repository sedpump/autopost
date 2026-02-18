
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { task, payload } = req.body;
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API_KEY не настроен." });
  }

  const cleanText = (text: string) => text ? text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "").trim() : "";
  const ai = new GoogleGenAI({ apiKey });

  try {
    if (task === 'rewrite') {
      const input = cleanText(payload.text);
      const length = payload.length || 'post';
      const comment = cleanText(payload.comment);
      if (!input) throw new Error("Пустой текст для обработки");

      let promptInstruction = "";
      // Устанавливаем лимиты, чтобы итоговый текст с футером влез в 1024 символа Telegram
      if (length === 'post') {
        promptInstruction = "Сгенерируй 3 коротких, емких варианта поста (максимум 600 символов каждый). Пиши живым языком, используй 2-3 эмодзи. Фокусируйся на главной мысли.";
      } else if (length === 'article' || length === 'longread') {
        promptInstruction = "Сгенерируй 3 экспертных текста. Соблюдай краткость: основной текст не должен превышать 700 символов. Пиши профессионально, но доступно. Избегай канцеляризмов.";
      }

      const refinementNote = comment ? `\nДОПОЛНИТЕЛЬНОЕ ПОЖЕЛАНИЕ: "${comment}". Учти это при генерации.` : "";

      const companyContext = `
      ВАЖНО: Каждый вариант ОБЯЗАТЕЛЬНО должен заканчиваться следующим текстом (включи его в общий объем):
      
      Доверяя сопровождение ипотеки Федеральному Ипотечному Сервису, вы получаете гарантию того, что ваш путь к новоселью будет защищен современными стандартами безопасности. Федеральный Ипотечный Сервис 8 (495) 143 83 33 info@fis-ipoteka.ru
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${promptInstruction} ${refinementNote} ${companyContext} 
        ОБЩИЙ ЛИМИТ СИМВОЛОВ ВКЛЮЧАЯ КОНТАКТЫ: 1000 знаков. ТЕКСТ СТРОГО НА РУССКОМ.
        Вариант 1: Полезный факт.
        Вариант 2: Дружелюбный совет.
        Вариант 3: Аналитика рынка.
        Исходные данные: ${input}`,
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
      const input = cleanText(payload.text);
      const comment = cleanText(payload.comment);
      
      const refinementNote = comment ? `\nUSER SPECIFIC FEEDBACK: "${comment}". Apply these changes to the visual concept.` : "";

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Create a professional photo prompt for image generation based on this topic: ${input.substring(0, 400)}. ${refinementNote} Style: Modern, clean, professional photography. No text in image. Output English prompt.`,
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
      const ar = payload.aspectRatio || "16:9";
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { 
          parts: [{ text: `High quality commercial style. ${prompt}` }] 
        },
        config: { 
          imageConfig: { 
            aspectRatio: ar as any 
          } 
        }
      });

      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (part?.inlineData) {
        return res.status(200).json({ base64: part.inlineData.data });
      }
      throw new Error("Не удалось сгенерировать изображение.");
    }

    return res.status(400).json({ error: "Unknown task" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
