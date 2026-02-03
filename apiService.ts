
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

// Работа с аккаунтами (Интеграции)
export const fetchAccounts = async (): Promise<any[]> => {
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

export const deleteAccount = async (id: string) => {
  await fetch(`/api/accounts?id=${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
};

export const postToPlatforms = async (article: Article) => {
  const response = await fetch('/api/publish', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      articleId: article.id,
      text: article.rewrittenText,
      image: article.generatedImageUrl
    })
  });
  if (!response.ok) throw new Error('Publishing failed');
  return await response.json();
};
