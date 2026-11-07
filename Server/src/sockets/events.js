// REST and socket sends share one publisher, separate from connection handlers.
let io;

export const roomChannel = (id) => `room:${String(id).toLowerCase()}`;
export const userChannel = (id) => `user:${String(id).toLowerCase()}`;
export const sessionChannel = (id) => `session:${id}`;

export function setIO(server) {
  io = server;
}

export function getIO() {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

export function publishMessage(message) {
  io?.to(roomChannel(message.room)).emit("newMessage", message);
}

export function publishRoomRead(user, room) {
  io?.to(userChannel(user)).emit("roomRead", { room: String(room) });
}

export function disconnectSession(sessionId) {
  io?.in(sessionChannel(sessionId)).disconnectSockets(true);
}

export function membersAdded(room, members) {
  if (!io) return;
  for (const user of members) {
    io.in(userChannel(user)).socketsJoin(roomChannel(room));
    io.to(userChannel(user)).emit("roomAdded", { room: String(room) });
  }
  io.to(roomChannel(room)).emit("membersAdded", { room: String(room), members });
}

export function membersRemoved(room, members) {
  if (!io) return;
  for (const user of members) {
    io.in(userChannel(user)).socketsLeave(roomChannel(room));
    io.to(userChannel(user)).emit("roomRemoved", { room: String(room) });
  }
  io.to(roomChannel(room)).emit("membersRemoved", { room: String(room), members });
}
