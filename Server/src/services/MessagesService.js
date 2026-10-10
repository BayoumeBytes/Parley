import { MessageModel } from "../models/Messages.js";

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
    const Messages = await MessageModel.find({ room }).sort({ createdAt: -1 });
    if (!Messages) return { error: "failed to get messages" };
    return Messages;
  } catch (e) {
    return { error: e.message };
  }
}
