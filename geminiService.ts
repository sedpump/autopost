
import { RewriteVariant } from './types';

export const rewriteArticle = async (text: string, length: 'post' | 'article' | 'longread' = 'post', comment?: string): Promise<RewriteVariant[]> => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'rewrite', payload: { text, length, comment } })
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Ошибка генерации текста");
  }
  
  const data = await response.json();
  return data.variants;
};

export const extractVisualPrompt = async (text: string, comment?: string): Promise<string> => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'vision', payload: { text, comment } })
  });
  
  if (!response.ok) throw new Error("Не удалось создать концепт изображения");
  const data = await response.json();
  return data.prompt || "";
};

export const generateImageForArticle = async (prompt: string, aspectRatio: '1:1' | '16:9' | '9:16' = '16:9'): Promise<string> => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'image', payload: { prompt, aspectRatio } })
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Ошибка генерации изображения");
  }
  
  const data = await response.json();
  return `data:image/png;base64,${data.base64}`;
};
