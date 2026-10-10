import { CreateMessage, GetRoomMessages } from "../services/MessagesService.js";

export async function SendMessage(req, res) {
  const { message, room, sender } = req.body;
  if (message == null || room == null || sender == null)
    return res.status(400).json({ error: "Missing required fields" });
  try {
    const Message = await CreateMessage(message, room, sender);
    if (!Message.error) return res.status(201).json({ result: "success" });
    return res.status(404).json({ error: "something went wrong" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function GetHistoryMessages(req, res) {
  const { room } = req.body;
  try {
    const result = await GetRoomMessages(room);
    if (result.error) return res.status(404).json({ error: result.error });
    return res.status(200).json({ History: result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
