
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { task, text, prompt } = req.body;

  if (!process.env.API_KEY) {
    return res.status(500).json({ error: "API_KEY is not configured on the server." });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    if (task === 'rewrite') {
      // Переключаемся на flash-версию, так как у нее больше лимитов в бесплатном тире
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: `Rewrite the following article to be engaging, professional, and optimized for social media platforms. Preserve the core facts but improve the flow and tone. Use emojis where appropriate. Article: ${text}` }] }],
        config: { 
          temperature: 0.7,
          // Убираем thinkingConfig для flash, чтобы избежать лишних затрат квоты
        },
      });
      return res.status(200).json({ result: response.text });
    }

    if (task === 'keywords') {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: `Extract 3-5 main keywords from this text as a JSON array of strings: ${text}` }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["keywords"]
          }
        }
      });
      const data = JSON.parse(response.text?.trim() || '{"keywords":[]}');
      return res.status(200).json(data);
    }

    if (task === 'image') {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `Professional social media illustration: ${prompt}` }] },
        config: { imageConfig: { aspectRatio: "16:9" } }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return res.status(200).json({ url: `data:image/png;base64,${part.inlineData.data}` });
        }
      }
      throw new Error("No image generated");
    }

    res.status(400).json({ error: "Unknown task" });
  } catch (error: any) {
    console.error("AI API Error:", error);
    res.status(500).json({ error: error.message });
  }
}
