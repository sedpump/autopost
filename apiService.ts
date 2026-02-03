
import { Platform, Article } from './types';

/**
 * PRODUCTION READY SERVICE
 * Этот сервис теперь может работать с реальным бэкендом.
 */
export const postToPlatforms = async (article: Article, platforms: Platform[], backendUrl?: string) => {
  const payload = {
    text: article.rewrittenText,
    image: article.generatedImageUrl,
    platforms: platforms,
    metadata: {
      originalSource: article.source,
      articleId: article.id,
      timestamp: new Date().toISOString()
    }
  };

  console.log(">>> DEPLOYING PAYLOAD:", payload);

  // Если URL бэкенда не задан, работаем в режиме симуляции
  if (!backendUrl) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { success: true, mode: 'simulation', message: "Simulated: Data logged to console." };
  }

  try {
    const response = await fetch(`${backendUrl}/api/post`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('api_token') || ''}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    
    return await response.json();
  } catch (error) {
    console.error("Backend error:", error);
    throw error;
  }
};
