
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
  userId: string;
  platform: Platform;
  name: string;
  credentials: {
    botToken?: string;
    chatId?: string;
    [key: string]: any;
  };
  isActive: boolean;
  createdAt: string;
}

export interface RewriteVariant {
  title: string;
  content: string;
}

export interface Article {
  id: string;
  userId: string;
  source: string;
  originalText: string;
  timestamp: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'posted';
  rewrittenText?: string;
  rewrittenVariants?: RewriteVariant[];
  selectedVariantIndex?: number;
  generatedImageUrl?: string;
  platforms?: Platform[];
}

export interface PostingStatus {
  platform: Platform;
  status: 'idle' | 'uploading' | 'success' | 'failed';
  link?: string;
}
