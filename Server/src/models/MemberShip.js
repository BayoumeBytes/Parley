import mongoose from "mongoose";

const MemberShipSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["owner", "admin", "member"], default: "member" },
  joinedAt: { type: Date, default: Date.now },
  lastReadAt: { type: Date, default: Date.now },
  lastReadMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
});

MemberShipSchema.index({ room: 1, user: 1 }, { unique: true });

MemberShipSchema.index({ user: 1 });

// export default mongoose.model("MemberShip", MemberShipSchema);

export const MemberShipModel = mongoose.model("MemberShip", MemberShipSchema);
