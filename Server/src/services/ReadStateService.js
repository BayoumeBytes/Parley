import mongoose from "mongoose";
import { MessageModel } from "../models/Messages.js";
import { MemberShipModel } from "../models/MemberShip.js";
import { chatError, requireRoomMember, validateId } from "./RoomAccessService.js";
import { publishRoomRead } from "../sockets/events.js";

const objectId = (value) => new mongoose.Types.ObjectId(String(value));

export function unreadFilter(membership, userId) {
  const since = new Date(membership.lastReadAt ?? membership.joinedAt ?? 0);
  const newer = [{ createdAt: { $gt: since } }];
  if (membership.lastReadMessage) {
    newer.push({ createdAt: since, _id: { $gt: objectId(membership.lastReadMessage) } });
  } else {
    newer.push({ createdAt: since });
  }
  return {
    room: objectId(membership.room),
    sender: { $ne: objectId(userId) },
    $or: newer,
  };
}

// Fetch previews and unread totals in batches, without downloading room histories.
export async function GetRoomSummaries(memberships, userId) {
  if (!memberships.length) return new Map();
  const [latest, unread] = await Promise.all([
    MessageModel.aggregate([
      { $match: { room: { $in: memberships.map((entry) => objectId(entry.room)) } } },
      { $sort: { createdAt: -1, _id: -1 } },
      { $group: { _id: "$room", lastMessage: { $first: "$$ROOT" } } },
    ]),
    MessageModel.aggregate([
      { $match: { $or: memberships.map((entry) => unreadFilter(entry, userId)) } },
      { $group: { _id: "$room", unreadCount: { $sum: 1 } } },
    ]),
  ]);
  const counts = new Map(unread.map((entry) => [String(entry._id), entry.unreadCount]));
  return new Map(latest.map((entry) => [
    String(entry._id),
    { lastMessage: entry.lastMessage, unreadCount: counts.get(String(entry._id)) ?? 0 },
  ]));
}

export async function MarkRoomRead(room, messageId, userId) {
  const roomId = validateId(room);
  const id = validateId(messageId, "message");
  await requireRoomMember(roomId, userId);
  const message = await MessageModel.findOne({ _id: id, room: roomId }).lean();
  if (!message) throw chatError(404, "Message not found in this conversation");
  // Advance only through a message the client actually displayed. A later,
  // simultaneous message must remain unread, and older tabs cannot rewind progress.
  await MemberShipModel.updateOne({
    room: roomId,
    user: userId,
    $or: [
      { lastReadAt: { $lt: message.createdAt } },
      { lastReadAt: message.createdAt, lastReadMessage: { $lt: message._id } },
      { lastReadAt: message.createdAt, lastReadMessage: { $exists: false } },
      { lastReadAt: { $exists: false } },
    ],
  }, { $set: { lastReadAt: message.createdAt, lastReadMessage: message._id } });
  publishRoomRead(userId, roomId);
  return { room: roomId };
}
