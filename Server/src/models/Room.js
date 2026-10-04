import mongoose from "mongoose";

export const RoomSchema = new mongoose.Schema({
  name: { type: String, default: "" },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  isGroup: { type: Boolean, default: false, required: true },
});
