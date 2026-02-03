
import { RewriteVariant } from './types';

export const rewriteArticle = async (text: string): Promise<RewriteVariant[]> => {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'rewrite', text })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.variants;
};

export const generateImageForArticle = async (prompt: string): Promise<string> => {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'image', prompt })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.url;
};

export const extractKeyConcepts = async (text: string): Promise<string[]> => {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'keywords', text })
  });
  const data = await response.json();
  return data.keywords || [];
};
