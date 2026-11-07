import { account, peer, room } from '../../../../testing/fixtures';
import { conversationTitle, otherParticipant, parseIdentifiers } from './conversations';

describe('conversation presentation', () => {
  it('uses group names and the other participant username without exposing IDs', () => {
    expect(conversationTitle(room, account._id)).toBe('Design studio');
    const direct = { ...room, roomDetails: { ...room.roomDetails!, type: 'direct' as const } };
    expect(conversationTitle(direct, account._id)).toBe('bob');
    expect(otherParticipant(direct, account._id)).toEqual(peer);
  });
  it('has readable fallbacks for deleted participants and unnamed legacy rooms', () => {
    expect(
      conversationTitle(
        { ...room, participants: [], roomDetails: { _id: room.room, type: 'direct' } },
        account._id,
      ),
    ).toBe('Deleted user');
    expect(
      conversationTitle({ ...room, roomDetails: { _id: room.room, type: 'group' } }, account._id),
    ).toBe('Unnamed group');
  });
  it('keeps spaces inside international numbers intact', () => {
    expect(parseIdentifiers('alice,\nbob@example.com, +20 101 234 5678')).toEqual([
      'alice',
      'bob@example.com',
      '+20 101 234 5678',
    ]);
  });
});
