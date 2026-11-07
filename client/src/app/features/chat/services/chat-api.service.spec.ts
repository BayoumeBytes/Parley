import { TestBed } from '@angular/core/testing';
import { message, room } from '../../../../testing/fixtures';
import { ApiService } from '../../../core/services/api.service';
import { ChatApiService } from './chat-api.service';

describe('ChatApiService endpoint contracts', () => {
  let request: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    request = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: { request } }],
    });
  });
  it('normalizes the legacy empty-room response', async () => {
    request.mockResolvedValue({ result: 'user doenst have rooms' });
    expect(await TestBed.inject(ChatApiService).rooms()).toEqual([]);
    expect(request).toHaveBeenCalledWith('conv/getuserrooms', {});
  });
  it('encodes history queries and sends messages only through REST', async () => {
    const api = TestBed.inject(ChatApiService);
    request.mockResolvedValueOnce({ History: [message] }).mockResolvedValueOnce({ message });
    expect(await api.history('room&extra')).toEqual([message]);
    expect(request).toHaveBeenNthCalledWith(1, 'msg/getroomhistory?room=room%26extra');
    expect(await api.send(room.room, 'Hello')).toEqual(message);
    expect(request).toHaveBeenNthCalledWith(2, 'msg/sendmsg', {
      room: room.room,
      message: 'Hello',
    });
  });
  it('unwraps direct and group creation responses consistently', async () => {
    const api = TestBed.inject(ChatApiService);
    request
      .mockResolvedValueOnce(room.roomDetails)
      .mockResolvedValueOnce({ room: room.roomDetails });
    expect(await api.create('direct', '', ['peer'])).toEqual(room.roomDetails);
    expect(await api.create('group', 'Team', ['peer'])).toEqual(room.roomDetails);
    expect(request).toHaveBeenLastCalledWith('conv/creategroup', {
      type: 'group',
      name: 'Team',
      members: ['peer'],
    });
  });
  it('preserves membership and read-acknowledgement payload shapes', async () => {
    request.mockResolvedValue({});
    const api = TestBed.inject(ChatApiService);
    await api.changeMembers(room.room, 'add', ['peer']);
    await api.changeMembers(room.room, 'remove', ['peer']);
    await api.markRead(room.room, message._id);
    expect(request).toHaveBeenNthCalledWith(1, 'conv/addmembers', {
      roomId: room.room,
      newmembers: ['peer'],
    });
    expect(request).toHaveBeenNthCalledWith(2, 'conv/removemembers', {
      roomId: room.room,
      members: ['peer'],
    });
    expect(request).toHaveBeenNthCalledWith(3, 'msg/markread', {
      room: room.room,
      messageId: message._id,
    });
  });
});
