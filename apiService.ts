
import { Platform, Article } from './types';

export const postToPlatforms = async (article: Article, platforms: Platform[], backendUrl?: string) => {
  const payload = {
    text: article.rewrittenText,
    image: article.generatedImageUrl,
    platforms: platforms,
    auth_token: localStorage.getItem('api_token') || '',
    metadata: {
      originalSource: article.source,
      articleId: article.id
    }
  };

  // Если backendUrl не пустой и не начинается на '/', используем его (для Railway)
  // Иначе используем встроенные Vercel Functions (/api/publish)
  const endpoint = backendUrl && !backendUrl.startsWith('/') 
    ? `${backendUrl}/api/publish` 
    : '/api/publish';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Publishing error:", error);
    throw error;
  }
};

export const fetchInbox = async () => {
  try {
    const response = await fetch('/api/articles');
    if (!response.ok) throw new Error('Failed to fetch inbox');
    return await response.json();
  } catch (error) {
    console.error("Inbox fetch error:", error);
    return [];
  }
};
