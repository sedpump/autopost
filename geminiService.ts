
import { GoogleGenAI, Type } from "@google/genai";
import { RewriteVariant } from './types';

// Вспомогательная функция для инициализации AI с актуальным ключом
const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const rewriteArticle = async (text: string): Promise<RewriteVariant[]> => {
  const ai = getAI();
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

  const textRes = response.text;
  if (!textRes) throw new Error("Модель вернула пустой ответ");
  const data = JSON.parse(textRes);
  return data.variants;
};

export const generateImageForArticle = async (prompt: string): Promise<string> => {
  // Проверяем наличие ключа перед вызовом Pro модели
  if (typeof (window as any).aistudio !== 'undefined') {
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await (window as any).aistudio.openSelectKey();
      // Согласно правилам: "Assume the key selection was successful after triggering openSelectKey"
    }
  }

  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { 
        parts: [{ text: `Editorial social media illustration, commercial quality, high resolution: ${prompt}. Clean background, no text, artistic composition, focus on central objects.` }] 
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
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("Изображение не найдено в ответе модели.");
  } catch (error: any) {
    // Если ключ невалиден или проект не найден
    if (error.message?.includes("Requested entity was not found")) {
       if (typeof (window as any).aistudio !== 'undefined') {
         await (window as any).aistudio.openSelectKey();
       }
    }
    throw error;
  }
};

export const extractKeyConcepts = async (text: string): Promise<string[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Ты экспертный концепт-художник. Твоя задача — прочитать текст поста и создать ОДИН максимально точный промпт (на английском) для генерации ИЛЛЮСТРАЦИИ к нему.
    Промпт должен:
    1. Отражать СУТЬ сообщения.
    2. Определять СТИЛЬ (professional photography, minimalist 3D render).
    3. КАТЕГОРИЧЕСКИ НЕ СОДЕРЖАТЬ текста.
    Текст поста: ${text}`,
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

  const textRes = response.text;
  if (!textRes) return [];
  const data = JSON.parse(textRes);
  return data.keywords || [];
};
