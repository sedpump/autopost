
import { Platform, Article, Source, Account } from './types';

const getAuthHeaders = () => {
  const user = JSON.parse(localStorage.getItem('omni_user') || '{}');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${user.token || ''}`
  };
};

const handleResponse = async (response: Response) => {
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Ошибка сервера: ${response.status}`);
    return data;
  } else {
    const text = await response.text();
    if (!response.ok) throw new Error(`Ошибка сервера (${response.status}): ${text.substring(0, 100)}`);
    return text;
  }
};

export const login = async (username: string) => {
  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
  return handleResponse(response);
};

export const fetchInbox = async (): Promise<Article[]> => {
  try {
    const response = await fetch('/api/articles', { headers: getAuthHeaders() });
    return await handleResponse(response);
  } catch (e) {
    console.error("Inbox fetch failed", e);
    return [];
  }
};

export const fetchSources = async (): Promise<Source[]> => {
  try {
    const response = await fetch('/api/sources', { headers: getAuthHeaders() });
    return await handleResponse(response);
  } catch (e) {
    return [];
  }
};

export const addSource = async (url: string): Promise<Source> => {
  const response = await fetch('/api/sources', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ url })
  });
  return handleResponse(response);
};

export const deleteSource = async (id: string) => {
  const response = await fetch(`/api/sources?id=${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

export const fetchAccounts = async (): Promise<Account[]> => {
  try {
    const response = await fetch('/api/accounts', { headers: getAuthHeaders() });
    return await handleResponse(response);
  } catch (e) {
    return [];
  }
};

export const addAccount = async (accountData: any) => {
  const response = await fetch('/api/accounts', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(accountData)
  });
  return handleResponse(response);
};

export const updateAccount = async (id: string, accountData: any) => {
  const response = await fetch('/api/accounts', {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ id, ...accountData })
  });
  return handleResponse(response);
};

export const deleteAccount = async (id: string) => {
  const response = await fetch(`/api/accounts?id=${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

export const uploadImage = async (imageBase64: string): Promise<string> => {
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ imageBase64 })
  });
  const data = await handleResponse(response);
  return data.url;
};

export const postToPlatforms = async (article: Article, preview: boolean = false, accountIds?: string[]) => {
  const response = await fetch(`/api/publish${preview ? '?preview=true' : ''}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      articleId: article.id,
      text: article.rewrittenText,
      image: article.generatedImageUrl,
      accountIds // Передаем список выбранных аккаунтов
    })
  });
  
  return handleResponse(response);
};
