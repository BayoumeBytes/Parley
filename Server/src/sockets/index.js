import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import { corsOptions } from "../config/config.js";
import { COOKIE_NAME, findValidSession } from "../middleware/requireAuth.js";
import { MemberShipModel } from "../models/MemberShip.js";
import { SendChatMessage } from "../services/MessagesService.js";
import { GetAccount } from "../services/AccountService.js";
import {
  chatError,
  requireRoomMember,
  validateId,
} from "../services/RoomAccessService.js";
import { roomChannel, userChannel, sessionChannel, setIO } from "./events.js";

export { getIO } from "./events.js";

export function initSockets(server) {
  const io = new Server(server, {
    cors: corsOptions,
    // CORS alone does not restrict WebSocket upgrades.
    allowRequest: (req, callback) => {
      callback(
        null,
        !req.headers.origin || req.headers.origin === corsOptions.origin,
      );
    },
  });
  setIO(io);
  const parseCookies = cookieParser();

  io.use((socket, next) => {
    parseCookies(socket.request, {}, async (error) => {
      if (error) return next(new Error("Unauthorized"));
      try {
        const session = await findValidSession(
          socket.request.cookies[COOKIE_NAME],
        );
        if (!session) return next(new Error("Unauthorized"));
        const user = await GetAccount(String(session.userId));
        if (user.requiresPhone) {
          const required = new Error("Add a primary phone number to continue");
          required.data = { code: "PHONE_REQUIRED", user };
          return next(required);
        }
        socket.data.user = user;
        socket.data.userId = session.userId.toString();
        socket.data.sessionId = session.sessionId;
        socket.data.expiresAt = new Date(session.expiresAt).getTime();
        next();
      } catch {
        next(new Error("Unable to authenticate"));
      }
    });
  });

  io.on("connection", (socket) => {
    const { userId, sessionId, expiresAt } = socket.data;
    socket.join(userChannel(userId));
    socket.join(sessionChannel(sessionId));
    const expiration = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, expiresAt - Date.now()),
    );
    expiration.unref();
    socket.on("disconnect", () => clearTimeout(expiration));

    const ready = (async () => {
      const memberships = await MemberShipModel.find({ user: userId })
        .select("room")
        .lean();
      if (!socket.connected) return;
      await socket.join(memberships.map(({ room }) => roomChannel(room)));
      socket.emit("ready", {
        userId,
        user: socket.data.user,
        rooms: memberships.map(({ room }) => String(room)),
      });
    })().catch(() => {
      socket.emit("chatError", { error: "Unable to load rooms", status: 500 });
      socket.disconnect(true);
    });

    const handle = (event, action) =>
      socket.on(event, async (payload, acknowledge) => {
        const reply =
          typeof acknowledge === "function"
            ? acknowledge
            : (result) => {
                if (!result.ok) socket.emit("chatError", result);
              };
        try {
          await ready;
          const session = await findValidSession(sessionId);
          if (!socket.connected || !session) {
            reply({ ok: false, error: "Unauthorized", status: 401 });
            socket.disconnect(true);
            return;
          }
          if (
            !payload ||
            typeof payload !== "object" ||
            Array.isArray(payload)
          ) {
            throw chatError(400, "Invalid event payload");
          }
          const result = await action(payload);
          reply({ ok: true, ...result });
        } catch (error) {
          reply({
            ok: false,
            status: error.status || 500,
            error: error.status ? error.message : "Internal server error",
          });
        }
      });

    handle("joinRoom", async ({ room }) => {
      const roomId = validateId(room);
      await requireRoomMember(roomId, userId);
      await socket.join(roomChannel(roomId));
      return { room: roomId };
    });
    handle("leaveRoom", async ({ room }) => {
      const roomId = validateId(room);
      await socket.leave(roomChannel(roomId));
      return { room: roomId };
    });
    handle("sendMessage", async ({ message, room }) => ({
      message: await SendChatMessage(message, room, userId),
    }));
    handle("typing", async ({ room, isTyping }) => {
      const roomId = validateId(room);
      if (typeof isTyping !== "boolean")
        throw chatError(400, "isTyping must be a boolean");
      await requireRoomMember(roomId, userId);
      socket
        .to(roomChannel(roomId))
        .emit("typing", { room: roomId, userId, isTyping });
      return { room: roomId };
    });
  });
  return io;
}
