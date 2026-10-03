import mongoose from "mongoose";

export const SessionSchema = new mongoose.Schema({
  SessionID: { type: String, required: true },
  userId: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});
