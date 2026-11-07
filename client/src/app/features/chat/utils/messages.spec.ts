import { groupMessages, mergeMessages } from './messages';
import { Message } from '../models/chat.models';

describe('message reconciliation', () => {
  const first: Message = {
    _id: '1',
    room: 'room',
    sender: 'user',
    message: 'Hello',
    createdAt: '2026-01-01T12:00:00Z',
  };
  const second: Message = {
    ...first,
    _id: '2',
    message: 'World',
    createdAt: '2026-01-01T12:01:00Z',
  };
  it('deduplicates history, REST response, and live events by persisted ID', () => {
    expect(mergeMessages([first], [second, first])).toEqual([first, second]);
  });
  it('orders newest-first history chronologically without mutating the input', () => {
    const history = [second, first];
    expect(mergeMessages([], history)).toEqual([first, second]);
    expect(history).toEqual([second, first]);
  });
  it('groups consecutive messages under the first message header without changing the source', () => {
    const messages = [first, second];
    expect(groupMessages(messages)).toEqual([
      {
        id: first._id,
        sender: first.sender,
        createdAt: first.createdAt,
        messages: [first, second],
      },
    ]);
    expect(messages).toEqual([first, second]);
  });
  it('starts a new group when the sender changes, even if an earlier sender returns', () => {
    const reply = { ...second, _id: '3', sender: 'other' };
    const returnMessage = { ...second, _id: '4' };
    expect(
      groupMessages([first, second, reply, returnMessage]).map((group) => group.messages),
    ).toEqual([[first, second], [reply], [returnMessage]]);
  });
  it('separates the same sender at a local calendar-day boundary', () => {
    const late = { ...first, createdAt: new Date(2026, 10, 5, 23, 59).toISOString() };
    const early = { ...second, createdAt: new Date(2026, 10, 6, 0, 1).toISOString() };
    expect(groupMessages([late, early])).toHaveLength(2);
  });
  it('keeps the header identity when a live message extends the current group', () => {
    expect(groupMessages([first])[0].id).toBe(groupMessages([first, second])[0].id);
    expect(groupMessages([])).toEqual([]);
  });
});
