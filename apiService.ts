
import { Platform, Article, Source, Account } from './types';

const getAuthHeaders = () => {
  const user = JSON.parse(localStorage.getItem('omni_user') || '{}');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${user.token || ''}`
  };
};

export const login = async (username: string) => {
  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
  if (!response.ok) throw new Error('Auth failed');
  return await response.json();
};

export const fetchInbox = async (): Promise<Article[]> => {
  const response = await fetch('/api/articles', {
    headers: getAuthHeaders()
  });
  if (!response.ok) return [];
  return await response.json();
};

export const fetchSources = async (): Promise<Source[]> => {
  const response = await fetch('/api/sources', {
    headers: getAuthHeaders()
  });
  if (!response.ok) return [];
  return await response.json();
};

export const addSource = async (url: string): Promise<Source> => {
  const response = await fetch('/api/sources', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ url })
  });
  if (!response.ok) throw new Error('Failed to add source');
  return await response.json();
};

export const deleteSource = async (id: string) => {
  await fetch(`/api/sources?id=${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
};

export const fetchAccounts = async (): Promise<Account[]> => {
  const response = await fetch('/api/accounts', {
    headers: getAuthHeaders()
  });
  return await response.json();
};

export const addAccount = async (accountData: any) => {
  const response = await fetch('/api/accounts', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(accountData)
  });
  return await response.json();
};

export const updateAccount = async (id: string, accountData: any) => {
  const response = await fetch('/api/accounts', {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ id, ...accountData })
  });
  return await response.json();
};

export const deleteAccount = async (id: string) => {
  await fetch(`/api/accounts?id=${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
};

export const postToPlatforms = async (article: Article, preview: boolean = false) => {
  const response = await fetch(`/api/publish${preview ? '?preview=true' : ''}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      articleId: article.id,
      text: article.rewrittenText,
      image: article.generatedImageUrl
    })
  });
  
  // Даже если ошибка, пытаемся распарсить JSON, чтобы вытащить debugData
  const data = await response.json();
  if (!response.ok && !data.results) {
    throw new Error(data.error || 'Publishing failed');
  }
  return data;
};
