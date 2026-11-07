import { Message, MessageGroup } from '../models/chat.models';

export function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const message of messages) {
    const previous = groups.at(-1);
    if (
      previous?.sender === message.sender &&
      new Date(previous.createdAt).toDateString() === new Date(message.createdAt).toDateString()
    ) {
      previous.messages.push(message);
    } else {
      groups.push({
        id: message._id,
        sender: message.sender,
        createdAt: message.createdAt,
        messages: [message],
      });
    }
  }
  return groups;
}

export function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  return [
    ...new Map([...current, ...incoming].map((message) => [message._id, message])).values(),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a._id.localeCompare(b._id));
}
