import mongoose from "mongoose";
import { normalizePhone } from "../utils/phone.util.js";

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: { type: String, required: true, set: normalizePhone },
  password: { type: String, required: true },
  Avatar: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true });
// Existing accounts without a phone remain readable; all new signups require one.
UserSchema.index({ phoneNumber: 1 }, {
  unique: true,
  partialFilterExpression: { phoneNumber: { $type: "string" } },
});

export const UserModel = mongoose.model("User", UserSchema);
