
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
      if (!input) throw new Error("Пустой текст для обработки");

      let promptInstruction = "";
      if (length === 'post') {
        promptInstruction = "Сгенерируй 3 коротких, емких варианта поста для соцсетей (до 600 символов). Используй эмодзи и призыв к действию.";
      } else if (length === 'article') {
        promptInstruction = "Сгенерируй 3 полноценных структурированных статьи (1000-2000 символов). Используй введение, основную часть и выводы. Стиль должен быть экспертным.";
      } else if (length === 'longread') {
        promptInstruction = "Сгенерируй 3 глубоких лонгрида (3000+ символов). Обязательно используй подзаголовки, маркированные списки, глубокую аналитику и детализацию. Это контент для Яндекс.Дзена или VC.ru.";
      }

      // Добавляем обязательный контекст компании
      const companyContext = `
      ОБЯЗАТЕЛЬНОЕ УСЛОВИЕ: В каждом варианте текста должно фигурировать упоминание, что контент подготовлен компанией 'Федеральный Ипотечный Сервис'. 
      В конце текста ОБЯЗАТЕЛЬНО добавь блок контактов:
      ---
      Контакты:
      Федеральный Ипотечный Сервис
      8 (495) 143 83 33
      info@fis-ipoteka.ru
      ---
      Упомяни, что по всем вопросам ипотеки и недвижимости можно обращаться к нам.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${promptInstruction} ${companyContext} ТЕКСТ ДОЛЖЕН БЫТЬ СТРОГО НА РУССКОМ ЯЗЫКЕ.
        Вариант 1: Информационный / Экспертный.
        Вариант 2: История / Сторителлинг.
        Вариант 3: Аналитический / Провокационный.
        Ориентир (тема/тезисы): ${input}`,
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
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Create a professional English image generation prompt for this content: ${input.substring(0, 1000)}. Style: Commercial high-end photography or minimalist 3D render. No text, focus on concepts.`,
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
          parts: [{ text: `Professional digital art, sharp focus, 8k resolution. Theme: ${prompt}` }] 
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
      throw new Error("ИИ не смог создать изображение. Попробуйте другой запрос.");
    }

    return res.status(400).json({ error: "Unknown task" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
