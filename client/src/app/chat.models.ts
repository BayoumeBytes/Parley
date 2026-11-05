export interface Room {
  _id: string;
  name?: string;
  type?: 'direct' | 'group';
}

export interface Membership {
  room: string;
  roomDetails?: Room;
  role?: 'owner' | 'admin' | 'member';
  user: { _id: string; username: string };
  participants?: { _id: string; username: string }[];
}

export interface Message {
  _id: string;
  room: string;
  sender: string;
  message: string;
  createdAt: string;
}

export function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  return [
    ...new Map([...current, ...incoming].map((message) => [message._id, message])).values(),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a._id.localeCompare(b._id));
}
