
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
      if (length === 'post') {
        promptInstruction = "Сгенерируй 3 живых, вовлекающих варианта поста для соцсетей. Пиши как человек для людей, используй уместное количество эмодзи. Сделай текст энергичным и понятным.";
      } else if (length === 'article') {
        promptInstruction = "Сгенерируй 3 экспертных статьи с естественным повествованием. Пиши живым, профессиональным языком. СТРОГО ЗАПРЕЩЕНО использовать заголовки типа 'Введение', 'Основная часть', 'Заключение' или 'Выводы'.";
      } else if (length === 'longread') {
        promptInstruction = "Сгенерируй 3 глубоких лонгрида. Используй интересные подзаголовки, списки и глубокую аналитику. Пиши в стиле качественного блога или статьи на VC.";
      }

      const refinementNote = comment ? `\nОБРАТИ ВНИМАНИЕ НА ПОЖЕЛАНИЕ ПОЛЬЗОВАТЕЛЯ: "${comment}". Измени или скорректируй текст в соответствии с этим комментарием.` : "";

      const companyContext = `
      ОБЯЗАТЕЛЬНО: Органично впиши в текст упоминание компании 'Федеральный Ипотечный Сервис'. 
      Текст должен внушать доверие и показывать, что мы эксперты в ипотеке.
      В самом конце каждого варианта добавь блок контактов БЕЗ лишних слов:
      
      Федеральный Ипотечный Сервис
      8 (495) 143 83 33
      info@fis-ipoteka.ru
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${promptInstruction} ${refinementNote} ${companyContext} ТЕКСТ ДОЛЖЕН БЫТЬ СТРОГО НА РУССКОМ ЯЗЫКЕ.
        Вариант 1: Полезный / Образовательный.
        Вариант 2: Дружелюбный / Совет от профи.
        Вариант 3: Трендовый / Взгляд на рынок.
        Темы для проработки: ${input}`,
        config: { 
          temperature: 0.9,
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
        contents: `Create a high-end commercial photo prompt for image generation based on this real estate/finance topic: ${input.substring(0, 500)}. ${refinementNote} Style: Professional photography, warm lighting, elegant interiors or abstract concepts of stability. No text in image. Output English prompt.`,
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
          parts: [{ text: `High quality commercial photography style. ${prompt}` }] 
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
      throw new Error("Не удалось сгенерировать изображение. Попробуйте обновить текст.");
    }

    return res.status(400).json({ error: "Unknown task" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
