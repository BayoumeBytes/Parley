import { mergeMessages, Message } from './chat.models';

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
});
