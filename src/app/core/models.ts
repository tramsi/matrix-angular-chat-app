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
  type?: 'm.text' | 'm.image' | 'm.file';
  status?: 'sending' | 'sent' | 'error';
}

export interface User {
  id: string;
  displayName: string;
  avatarUrl?: string;
  presence?: 'online' | 'offline' | 'unavailable';
}
