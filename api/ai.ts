
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
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: `Rewrite the following article to be engaging, professional, and optimized for social media platforms. Use emojis. Article: ${text}` }] }],
        config: { temperature: 0.7 },
      });
      return res.status(200).json({ result: response.text });
    }

    if (task === 'keywords') {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: `Extract 3 main keywords from this text as a JSON array: ${text}` }] }],
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
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: `A clean, modern professional social media illustration about: ${prompt}. Cinematic lighting, high quality.` }] },
          config: { imageConfig: { aspectRatio: "16:9" } }
        });

        const candidates = response.candidates || [];
        if (candidates.length > 0) {
          for (const part of candidates[0].content.parts) {
            if (part.inlineData) {
              return res.status(200).json({ url: `data:image/png;base64,${part.inlineData.data}` });
            }
          }
        }
        
        // Если картинка не вернулась, но ошибки API не было (например, модель вернула текст)
        throw new Error("Model returned no image data");
      } catch (innerError: any) {
        console.error("Internal Image Error:", innerError);
        return res.status(500).json({ error: "Image generation failed: " + innerError.message });
      }
    }

    res.status(400).json({ error: "Unknown task" });
  } catch (error: any) {
    console.error("AI API Error:", error);
    res.status(500).json({ error: error.message });
  }
}
