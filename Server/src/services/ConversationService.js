import { RoomModel } from "../models/Room.js";
import { MemberShipModel } from "../models/MemberShip.js";
import { GetRoomSummaries } from "./ReadStateService.js";
import { publicUser } from "./AccountService.js";

/**
 * @param {unknown[]} list
 * @return {string[]}
 */
const normalize = (list) => [...new Set([list].flat().map(String))];

export async function CreateRoom(name = "", members, type, creatorId) {
  try {
    const ids = normalize(members);
    if (type == "direct") {
      if (ids.length !== 2) {
        return { error: "A direct chat needs exactly 2 different users" };
      }

      const directKey = [...ids].sort().join(":");

      const room = await RoomModel.findOneAndUpdate(
        { directKey },
        { $setOnInsert: { type: "direct" } }, // directKey is added from the filter
        { upsert: true, returnDocument: "after" },
      );

      await addMemberships(room._id, ids);
      return room;
    }
    if (type == "group") {
      if (!name?.trim()) return { error: "Group rooms require a name" };
      const room = await RoomModel.create({ name: name.trim(), type: "group" });
      await addMemberships(room._id, ids, creatorId);
      return { room };
    }
    return { error: "Invalid room type" };
  } catch (error) {
    if (error.code === 11000 && type === "direct") {
      const directKey = normalize(members).sort().join(":");
      const room = await RoomModel.findOne({ directKey });
      if (room) return { room };
    }
    console.error(error);
    return { error: error.message };
  }
}

async function addMemberships(roomId, userIds, ownerId = null) {
  await MemberShipModel.bulkWrite(
    userIds.map((user) => ({
      updateOne: {
        filter: { room: roomId, user },
        update: {
          $setOnInsert: {
            joinedAt: new Date(),
            lastReadAt: new Date(),
            role: String(user) === String(ownerId) ? "owner" : "member",
          },
        },
        upsert: true,
      },
    })),
  );
}

export async function AddMembersToGroup(roomId, members) {
  try {
    const room = await RoomModel.findOne({ _id: roomId });
    if (!room) return { error: "Room not found" };
    if (room.type !== "group") return { error: "Room is not a group" };

    const incoming = normalize(members);
    const existing = await MemberShipModel.find({
      room: roomId,
      user: { $in: incoming },
    }).distinct("user");
    const existingSet = new Set(existing.map(String));

    const toAdd = incoming.filter((id) => !existingSet.has(id));
    if (toAdd.length === 0) return { error: "Users are already in room" };

    await addMemberships(roomId, toAdd);
    return { success: true, added: toAdd };
  } catch (error) {
    console.error(error);
    return { error: error.message };
  }
}

export async function RemoveMembersFromGroup(roomId, members) {
  try {
    const room = await RoomModel.findOne({ _id: roomId });
    if (!room) return { error: "Room not found" };
    if (room.type !== "group") return { error: "Room is not a group" };

    const incoming = normalize(members);
    const existing = await MemberShipModel.find({
      room: roomId,
      user: { $in: incoming },
    }).distinct("user");
    const existingSet = new Set(existing.map(String));

    const toRemove = incoming.filter((id) => existingSet.has(id));
    if (toRemove.length === 0) return { error: "Users are not in room" };

    await MemberShipModel.deleteMany({ room: roomId, user: { $in: toRemove } });
    return { success: true, removed: toRemove };
  } catch (error) {
    console.error(error);
    return { error: error.message };
  }
}

export async function GetUserRooms(userId) {
  try {
    const membership = await MemberShipModel.find({ user: userId })
      .select("room user role joinedAt lastReadAt lastReadMessage -_id")
      .populate("user", "username _id color")
      .populate("room", "name type")
      .lean();
    if (!membership) return null;
    const roomIds = membership.filter((entry) => entry.room).map((entry) => entry.room._id ?? entry.room);
    const participants = roomIds.length ? await MemberShipModel.find({ room: { $in: roomIds } })
      .select("room user -_id")
      .populate("user", "username _id color")
      .lean() : [];
    const participantsByRoom = new Map();
    for (const member of participants) {
      if (!member.user) continue;
      const roomId = String(member.room);
      const users = participantsByRoom.get(roomId) ?? [];
      users.push(publicUser(member.user));
      participantsByRoom.set(roomId, users);
    }
    const rooms = membership.filter((entry) => entry.room).map((entry) => ({
      ...entry,
      user: publicUser(entry.user),
      room: entry.room._id ?? entry.room,
      roomDetails: entry.room._id ? entry.room : undefined,
      participants: participantsByRoom.get(String(entry.room._id ?? entry.room)) ?? [],
    }));
    const summaries = await GetRoomSummaries(rooms, userId);
    return rooms.map((entry) => ({
      ...entry,
      lastMessage: null,
      unreadCount: 0,
      ...summaries.get(String(entry.room)),
    }));
  } catch (error) {
    return { error: error.message };
  }
}
