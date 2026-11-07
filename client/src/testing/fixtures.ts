import { Account, Person } from '../app/core/models/account.models';
import { Membership, Message } from '../app/features/chat/models/chat.models';

export const account: Account = {
  _id: 'b'.repeat(24),
  username: 'alice',
  color: '#48e695',
  phoneNumber: '+12025550123',
  requiresPhone: false,
};
export const peer: Person = { _id: 'c'.repeat(24), username: 'bob', color: '#a5c5e6' };
export const room: Membership = {
  room: 'a'.repeat(24),
  role: 'owner',
  user: account,
  roomDetails: { _id: 'a'.repeat(24), type: 'group', name: 'Design studio' },
  participants: [account, peer],
};
export const message: Message = {
  _id: 'message',
  room: room.room,
  sender: peer._id,
  message: 'Hello',
  createdAt: '2026-11-05T12:00:00Z',
};
export function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
