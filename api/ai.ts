
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
        contents: `Generate 3 distinct social media post variants for this article. 
        Variant 1: Professional, expert and informative tone. 
        Variant 2: Viral, engaging, creative with emojis and call-to-actions. 
        Variant 3: Ultra-short, punchy "TL;DR" version.
        Article: ${text}`,
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
        contents: `Extract 3 main visual descriptive keywords for high-quality image generation from this text as a JSON array. Focus on metaphors and objects. Text: ${text}`,
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
        // Using 'gemini-3-pro-image-preview' for top-tier generation
        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: { 
            parts: [{ text: `A high-end, professional commercial 3D render illustration for a social media post: ${prompt}. Cinematic lighting, minimalist style, sharp focus, 8k resolution, clean background.` }] 
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
        throw new Error("Model failed to provide image binary data.");
      } catch (innerError: any) {
        console.error("Pro Image Generation Error:", innerError);
        return res.status(500).json({ error: "Pro Image generation failed: " + innerError.message });
      }
    }

    res.status(400).json({ error: "Unknown task" });
  } catch (error: any) {
    console.error("AI API Error:", error);
    res.status(500).json({ error: error.message });
  }
}
