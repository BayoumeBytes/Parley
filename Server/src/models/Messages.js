import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

MessageSchema.index({ room: 1 });
MessageSchema.index({ room: 1, createdAt: -1, _id: -1 });
MessageSchema.index({ sender: 1 });

// type Message = InferSchemaType<typeof MessageSchema>;

// export const MessageModel = model<Message>("Message", MessageSchema);
export const MessageModel = mongoose.model("Message", MessageSchema);
