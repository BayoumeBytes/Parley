import {
  CreateRoom,
  AddMembersToGroup,
  RemoveMembersFromGroup,
  GetUserRooms,
} from "../services/ConversationService.js";

export async function CreateGroup(req, res) {
  const { name, members, type } = req.body;
  if (members == null || type == null) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (type == "group" && name == null) {
    return res.status(400).json({ error: "Missing name field" });
  }
  try {
    const newGroup = await CreateRoom(name, members, type, req.user.id);
    if (!newGroup) {
      return res.status(500).json({ error: "Failed to create group" });
    }
    return res.status(200).json(newGroup);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export async function AddMembers(req, res) {
  const { roomId, newmembers: NewMembers } = req.body;
  if (NewMembers == null || roomId == null) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const updateRoom = await AddMembersToGroup(roomId, NewMembers);
    return res.status(200).json(updateRoom);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export async function RemoveMembers(req, res) {
  const { roomId, members: MembersToRemove } = req.body;
  if (MembersToRemove == null || roomId == null) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const updatedRoom = await RemoveMembersFromGroup(roomId, MembersToRemove);
    return res.status(200).json(updatedRoom);
  } catch (error) {
    return res.status(500).json({ error: error.message });
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
