import mongoose from "mongoose";

const RoomSchema = new mongoose.Schema({
  name: { type: String, default: "" },
  type: { type: String, enum: ["group", "direct"], required: true },
  directKey: { type: String },
});

RoomSchema.index(
  { directKey: 1 },
  { unique: true, partialFilterExpression: { directKey: { $type: "string" } } },
);

export const RoomModel = mongoose.model("Room", RoomSchema);
