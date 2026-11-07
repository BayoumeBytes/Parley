import { MessageModel } from "../models/Messages.js";
import { chatError, requireRoomMember, validateId } from "./RoomAccessService.js";
import { publishMessage } from "../sockets/events.js";

export async function SendChatMessage(text, room, sender) {
  const roomId = validateId(room);
  if (typeof text !== "string" || !text.trim() || text.length > 10000) {
    throw chatError(400, "Message must contain 1 to 10000 characters");
  }
  await requireRoomMember(roomId, sender);
  const message = await CreateMessage(text, roomId, sender);
  if (message.error) throw chatError(500, "Failed to create message");
  publishMessage(message);
  return message;
}

export async function CreateMessage(text, room, sender) {
  try {
    const msg = await MessageModel.create({ message: text, room, sender });
    if (!msg) return { error: "failed to create message" };
    return msg;
  } catch (e) {
    return { error: e.message };
  }
}

export async function GetRoomMessages(room) {
  try {
    const Messages = await MessageModel.find({ room }).sort({ createdAt: -1, _id: -1 });
    if (!Messages) return { error: "failed to get messages" };
    return Messages;
  } catch (e) {
    return { error: e.message };
  }
}
