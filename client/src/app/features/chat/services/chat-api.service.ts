import { inject, Injectable } from '@angular/core';
import { Person } from '../../../core/models/account.models';
import { ApiService } from '../../../core/services/api.service';
import { MemberAction, Membership, Message, Room, RoomType } from '../models/chat.models';

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private readonly api = inject(ApiService);

  async rooms(): Promise<Membership[]> {
    const { result } = await this.api.request<{ result: Membership[] | string }>(
      'conv/getuserrooms',
      {},
    );
    return Array.isArray(result) ? result : [];
  }
  async history(room: string): Promise<Message[]> {
    const { History } = await this.api.request<{ History: Message[] }>(
      `msg/getroomhistory?room=${encodeURIComponent(room)}`,
    );
    return History;
  }
  async send(room: string, message: string): Promise<Message> {
    const result = await this.api.request<{ message: Message }>('msg/sendmsg', { room, message });
    return result.message;
  }
  markRead(room: string, messageId: string): Promise<unknown> {
    return this.api.request('msg/markread', { room, messageId });
  }
  async resolve(identifiers: string[]): Promise<Person[]> {
    const { users } = await this.api.request<{ users: Person[] }>('users/resolve', { identifiers });
    return users;
  }
  async create(type: RoomType, name: string, members: string[]): Promise<Room> {
    const result = await this.api.request<Room | { room: Room }>('conv/creategroup', {
      type,
      name,
      members,
    });
    return 'room' in result ? result.room : result;
  }
  changeMembers(roomId: string, action: MemberAction, members: string[]): Promise<unknown> {
    return this.api.request(`conv/${action === 'add' ? 'addmembers' : 'removemembers'}`, {
      roomId,
      [action === 'add' ? 'newmembers' : 'members']: members,
    });
  }
}
