
export enum Platform {
  TELEGRAM = 'Telegram',
  VK = 'VK',
  INSTAGRAM = 'Instagram',
  DZEN = 'Dzen',
  TENCHAT = 'TenChat',
  PIKABU = 'Pikabu'
}

export interface User {
  id: string;
  username: string;
  token?: string;
}

export interface Source {
  id: string;
  userId: string;
  name: string;
  url: string;
  type: 'channel' | 'group' | 'bot';
  isActive: boolean;
  createdAt: string;
}

export interface Account {
  id: string;
  platform: Platform;
  username: string;
  status: 'connected' | 'expired' | 'error';
  lastPostDate?: string;
}

export interface Article {
  id: string;
  userId: string;
  source: string;
  originalText: string;
  timestamp: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'posted';
  rewrittenText?: string;
  generatedImageUrl?: string;
  platforms?: Platform[];
}

export interface PostingStatus {
  platform: Platform;
  status: 'idle' | 'uploading' | 'success' | 'failed';
  link?: string;
}
