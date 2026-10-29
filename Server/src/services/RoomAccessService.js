import mongoose from "mongoose";
import { MemberShipModel } from "../models/MemberShip.js";

export function chatError(status, message) {
  return Object.assign(new Error(message), { status });
}

export function validateId(id, field = "room") {
  if (typeof id !== "string" || !mongoose.isObjectIdOrHexString(id)) {
    throw chatError(400, `Invalid ${field}`);
  }
  return id.toLowerCase();
}

export async function requireRoomMember(room, user, manage = false) {
  const roomId = validateId(room);
  const membership = await MemberShipModel.findOne({ room: roomId, user });
  if (!membership) throw chatError(403, "You are not a member of this room");
  if (manage && !["owner", "admin"].includes(membership.role)) {
    throw chatError(403, "Only room owners and admins can manage members");
  }
  return membership;
}
