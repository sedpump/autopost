
import { GoogleGenAI, Type } from "@google/genai";

export const rewriteArticle = async (text: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{ parts: [{ text: `Rewrite the following article to be engaging, professional, and optimized for social media platforms. Preserve the core facts but improve the flow and tone. Use emojis where appropriate for Telegram/Instagram. Article: ${text}` }] }],
    config: {
      temperature: 0.8,
      topP: 0.95,
      thinkingConfig: { thinkingBudget: 4000 }
    },
  });
  return response.text || "Failed to rewrite article.";
};

export const generateImageForArticle = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: `A high-quality, professional editorial illustration or photo for a social media post about: ${prompt}. Cinematic lighting, modern aesthetic, clean composition.` }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
};

export const extractKeyConcepts = async (text: string): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: `Extract 3-5 main keywords or themes from this text as a comma separated list: ${text}` }] }],
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
    try {
        const data = JSON.parse(response.text || '{"keywords": []}');
        return data.keywords;
    } catch {
        return [];
    }
}
