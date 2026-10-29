import { Server } from "socket.io";
import { config } from "../config/config.js";

let io;
export function initSockets(server) {
  io = new Server(server, {
    cors: { origin: true, credentials: true },
  });

  io.on("connection", (socket) => {
    console.log("user connected:", socket.id);
    socket.on("disconnect", () => console.log("user disconnected:", socket.id));

    socket.on("newMessage", (test) => {
      console.log("hello socket");
    });
  });

  io.engine.on("connection_error", (err) => {
    console.log(err.code, err.message, err.context);
  });

  return io;
}

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};
