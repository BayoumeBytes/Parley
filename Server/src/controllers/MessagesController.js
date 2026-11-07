import { SendChatMessage, GetRoomMessages } from "../services/MessagesService.js";
import { requireRoomMember } from "../services/RoomAccessService.js";
import { MarkRoomRead } from "../services/ReadStateService.js";

export async function MarkRead(req, res) {
  try {
    return res.json(await MarkRoomRead(req.body?.room, req.body?.messageId, req.user.id));
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status ? error.message : "Unable to save read progress",
    });
  }
}

export async function SendMessage(req, res) {
  const { message, room } = req.body ?? {};
  if (message == null || room == null)
    return res.status(400).json({ error: "Missing required fields" });
  try {
    const saved = await SendChatMessage(message, room, req.user.id);
    return res.status(201).json({ result: "success", message: saved });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.status ? e.message : "Internal server error" });
  }
}

export async function GetHistoryMessages(req, res) {
  const room = req.query.room ?? req.body?.room;
  try {
    await requireRoomMember(room, req.user.id);
    const result = await GetRoomMessages(room);
    if (result.error) return res.status(404).json({ error: result.error });
    return res.status(200).json({ History: result });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.status ? e.message : "Internal server error" });
  }
}
