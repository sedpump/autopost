
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { task, payload } = req.body;
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API_KEY не настроен." });
  }

  const cleanText = (text: any): string => typeof text === 'string' ? text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "").trim() : "";
  const ai = new GoogleGenAI({ apiKey });

  try {
    if (task === 'fetch_instagram') {
      const url = payload.url;
      if (!url) throw new Error("URL не указан");

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `Твоя задача — найти текст последних 3-х постов из открытого профиля Instagram: ${url}. 
        
        ИНСТРУКЦИЯ:
        1. Используй Google Search, чтобы найти последние публикации этого аккаунта. Ищи прямые ссылки на посты, цитаты в СМИ или агрегаторах.
        2. Если прямой доступ к Instagram заблокирован, найди описание или текст этих постов на других сайтах (например, в ВК, новостях или на форумах).
        3. Текст должен быть максимально полным. Если текста много, извлеки хотя бы первые 500-1000 символов.
        4. Верни результат СТРОГО в формате JSON.
        
        Каждая статья должна иметь:
        - originalText: текст поста на русском языке.
        - source: название аккаунта.
        - timestamp: дата поста.
        
        Если постов не найдено, верни {"articles": []}.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              articles: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    originalText: { type: Type.STRING },
                    source: { type: Type.STRING },
                    timestamp: { type: Type.STRING }
                  },
                  required: ["originalText", "source", "timestamp"]
                }
              }
            },
            required: ["articles"]
          }
        }
      });
      return res.status(200).json(JSON.parse(response.text || "{}"));
    }

    if (task === 'rewrite') {
      const input = cleanText(payload.text);
      const length = payload.length || 'post';
      const comment = cleanText(payload.comment);
      const platform = payload.platform; // New parameter
      if (!input) throw new Error("Пустой текст для обработки");

      let promptInstruction = "";
      let variantDescriptions = "";

      if (platform === 'telegram') {
        promptInstruction = `Сгенерируй 3 варианта поста специально для Telegram. 
        СТИЛЬ: "Телеграмный" — живой, вовлекающий, с ОБИЛИЕМ тематических эмодзи (как в примере: 🔹, 🆕, ➡️, 🔔, 🔵).
        СТРУКТУРА: Используй четкое разделение на абзацы, списки с буллитами-эмодзи, важные акценты выделяй жирным.
        ОГРАНИЧЕНИЯ: Каждый вариант должен быть до 1000 символов (чтобы поместиться в подпись к фото).
        ФОКУС: Польза для клиента, экспертность.`;
        variantDescriptions = `
        Вариант 1: Структурированный разбор (как в примере пользователя).
        Вариант 2: Эмоциональный и вовлекающий пост с призывом к действию.
        Вариант 3: Краткая сводка новостей/изменений.`;
      } else if (length === 'post') {
        promptInstruction = "Сгенерируй 3 коротких, емких варианта поста (600-1000 символов каждый). Пиши живым языком, используй 2-3 эмодзи. Фокусируйся на пользе для клиента.";
        variantDescriptions = `
        Вариант 1: Полезный инсайт.
        Вариант 2: Практический совет.
        Вариант 3: Краткий разбор ситуации.`;
      } else if (length === 'article') {
        promptInstruction = "Сгенерируй 2 развернутых экспертных статьи (2500-4000 символов каждая). Используй подзаголовки, списки и глубокую аналитику. Пиши профессионально, но доступно.";
        variantDescriptions = `
        Вариант 1: Аналитическая статья с глубоким разбором.
        Вариант 2: Практическое руководство (How-to) с пошаговым планом.`;
      } else if (length === 'longread') {
        promptInstruction = "Сгенерируй 1 максимально подробный и структурированный лонгрид (от 5000 символов). Это должен быть полноценный экспертный материал, гайд или исследование. Используй четкую структуру: введение, несколько глав с подзаголовками, маркированные списки, важные выноски и итоговое заключение.";
        variantDescriptions = `
        Вариант 1: Полноценный лонгрид-исследование.`;
      }

      const refinementNote = comment ? `\nДОПОЛНИТЕЛЬНОЕ ПОЖЕЛАНИЕ ОТ ПОЛЬЗОВАТЕЛЯ: "${comment}". Обязательно учти это.` : "";

      const companyContext = `
      ВАЖНО: Органично и гармонично впиши упоминание бренда "Федеральный Ипотечный Сервис" в текст каждого варианта. 
      Бренд должен упоминаться как экспертный помощник или гарант безопасности, но без навязчивой рекламы. 
      СТРОГО ЗАПРЕЩЕНО добавлять номер телефона, email или адрес сайта. Только название компании.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${promptInstruction} ${refinementNote} ${companyContext} 
        ИТОГОВЫЙ ТЕКСТ ДОЛЖЕН БЫТЬ СТРОГО НА РУССКОМ ЯЗЫКЕ.
        ${variantDescriptions}
        Исходная тема: ${input}`,
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
      return res.status(200).json(JSON.parse(response.text || "{}"));
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
      return res.status(200).json(JSON.parse(response.text || "{}"));
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

      const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
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
