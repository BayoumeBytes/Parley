import mongoose from "mongoose";

export const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  expiresAt: { type: Date, required: true },
});

export const SessionModel = mongoose.model("Session", SessionSchema);
