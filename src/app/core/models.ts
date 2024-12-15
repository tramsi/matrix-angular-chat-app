import { MsgType } from 'matrix-js-sdk/lib/types';

export interface Room {
  roomId: string;
  name: string;

  lastMessage?: Message;
  unreadCount?: number;
}

export interface Message {
  id?: string;
  content: string;
  sender: string;
  timestamp: number;
  type?: string;
  status?: 'sending' | 'sent' | 'error';
  media?: { url: string | null | undefined; type: 'image' | 'file' }[];
}

export interface User {
  id: string;
  displayName: string;
  avatarUrl?: string;
  presence?: 'online' | 'offline' | 'unavailable';
}
