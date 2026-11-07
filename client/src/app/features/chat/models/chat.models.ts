import { Person } from '../../../core/models/account.models';

export type RoomType = 'direct' | 'group';
export type MemberAction = 'add' | 'remove';
export type DialogKind = 'create' | 'members';
export const MAX_MESSAGE_LENGTH = 10000;

export interface Room {
  _id: string;
  name?: string;
  type?: RoomType;
}

export interface Membership {
  room: string;
  roomDetails?: Room;
  role?: 'owner' | 'admin' | 'member';
  user: Person;
  participants?: Person[];
  unreadCount?: number;
  lastMessage?: Message | null;
}

export interface Message {
  _id: string;
  room: string;
  sender: string;
  message: string;
  createdAt: string;
}

export interface MessageGroup {
  id: string;
  sender: string;
  createdAt: string;
  messages: Message[];
}

export type ConversationCommand =
  | { kind: 'create'; type: RoomType; name: string; identifiers: string[] }
  | { kind: 'members'; action: MemberAction; identifiers: string[] };
