
import { RewriteVariant } from './types';

export const rewriteArticle = async (text: string): Promise<RewriteVariant[]> => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'rewrite', payload: { text } })
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Ошибка генерации текста");
  }
  
  const data = await response.json();
  return data.variants;
};

export const extractKeyConcepts = async (text: string): Promise<string[]> => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'vision', payload: { text } })
  });
  
  if (!response.ok) return [];
  const data = await response.json();
  return data.keywords || [];
};

export const generateImageForArticle = async (prompt: string): Promise<string> => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'image', payload: { prompt } })
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Ошибка генерации изображения");
  }
  
  const data = await response.json();
  return `data:image/png;base64,${data.base64}`;
};
