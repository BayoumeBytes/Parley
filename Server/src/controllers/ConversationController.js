import {
  CreateRoom,
  AddMembersToGroup,
  RemoveMembersFromGroup,
  GetUserRooms,
} from "../services/ConversationService.js";
import { requireRoomMember, validateId, chatError } from "../services/RoomAccessService.js";
import { membersAdded, membersRemoved } from "../sockets/events.js";

function validateMembers(members) {
  if (!Array.isArray(members) || members.length === 0) {
    throw chatError(400, "members must be a non-empty array");
  }
  return [...new Set(members.map((id) => validateId(id, "member")))];
}

const sendError = (res, error) => res.status(error.status || 500)
  .json({ error: error.status ? error.message : "Internal server error" });

export async function CreateGroup(req, res) {
  const { name, members, type } = req.body ?? {};
  if (members == null || type == null) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (type == "group" && name == null) {
    return res.status(400).json({ error: "Missing name field" });
  }
  try {
    const ids = validateMembers(members);
    if (!ids.includes(req.user.id)) ids.push(req.user.id);
    if (name != null && typeof name !== "string") throw chatError(400, "Invalid name");
    const newGroup = await CreateRoom(name, ids, type, req.user.id);
    if (!newGroup) {
      return res.status(500).json({ error: "Failed to create group" });
    }
    if (newGroup.error) return res.status(400).json(newGroup);
    membersAdded((newGroup.room ?? newGroup)._id, ids);
    return res.status(200).json(newGroup);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function AddMembers(req, res) {
  const { roomId, newmembers: NewMembers } = req.body ?? {};
  if (NewMembers == null || roomId == null) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const ids = validateMembers(NewMembers);
    await requireRoomMember(roomId, req.user.id, true);
    const updateRoom = await AddMembersToGroup(roomId, ids);
    if (updateRoom.error) return res.status(400).json(updateRoom);
    membersAdded(roomId, updateRoom.added);
    return res.status(200).json(updateRoom);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function RemoveMembers(req, res) {
  const { roomId, members: MembersToRemove } = req.body ?? {};
  if (MembersToRemove == null || roomId == null) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const ids = validateMembers(MembersToRemove);
    await requireRoomMember(roomId, req.user.id, true);
    const updatedRoom = await RemoveMembersFromGroup(roomId, ids);
    if (updatedRoom.error) return res.status(400).json(updatedRoom);
    membersRemoved(roomId, updatedRoom.removed);
    return res.status(200).json(updatedRoom);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function GetRooms(req, res) {
  const userId = req.user.id;
  try {
    const result = await GetUserRooms(userId);
    if (result == null) {
      return res.status(200).json({ result: "user doenst have rooms" });
    }
    return res.status(200).json({ result: result });
  } catch (err) {
    return res.status(501).json({ error: err.message });
  }
}
