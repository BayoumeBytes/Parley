import { Membership } from '../models/chat.models';

export function otherParticipant(room: Membership, userId: string) {
  return room.participants?.find((person) => person._id !== userId);
}

export function conversationTitle(room: Membership, userId: string): string {
  return room.roomDetails?.type === 'group'
    ? room.roomDetails.name || 'Unnamed group'
    : otherParticipant(room, userId)?.username || 'Deleted user';
}

export function parseIdentifiers(value: string): string[] {
  // A formatted phone number can contain spaces; split only between people.
  return value
    .split(/[,\n]+/)
    .map((identifier) => identifier.trim())
    .filter(Boolean);
}
