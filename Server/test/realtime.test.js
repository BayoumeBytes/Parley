import { createServer } from "node:http";
import { once } from "node:events";
import supertest from "supertest";
import { localRequest } from "./helpers/localRequest.js";
import { app } from "../src/app.js";
import { initSockets } from "../src/sockets/index.js";
import { setIO } from "../src/sockets/events.js";
import { SessionModel } from "../src/models/Session.js";
import { MemberShipModel } from "../src/models/MemberShip.js";
import { MessageModel } from "../src/models/Messages.js";
import { RoomModel } from "../src/models/Room.js";
import { UserModel } from "../src/models/Users.js";
import { hash } from "../src/utils/password.util.js";
import { SocketClient } from "./helpers/SocketClient.js";
import { accountColor } from "../../shared/account-color.mjs";

const alice = "000000000000000000000001";
const bob = "000000000000000000000002";
const eve = "000000000000000000000003";
const room = "000000000000000000000011";
const otherRoom = "000000000000000000000012";
let server, io, baseUrl, sessions, memberships, messages, clients;
const network = process.env.REALTIME_NETWORK === "1";
const request = network ? supertest : localRequest;

async function connect(session = "alice") {
  const client = new SocketClient(network ? baseUrl : io, `session=${session}`);
  clients.push(client);
  await client.connect();
  await client.next("ready");
  return client;
}

beforeEach(async () => {
  clients = [];
  sessions = new Map([...[ ["alice", alice], ["bob", bob], ["eve", eve] ].map(([sessionId, userId]) =>
    [sessionId, { sessionId, userId, expiresAt: new Date(Date.now() + 60000) }])]);
  memberships = [
    { room, user: alice, role: "owner" }, { room, user: bob, role: "member" },
    { room: otherRoom, user: eve, role: "owner" },
  ];
  messages = [];
  jest.spyOn(UserModel, "findById").mockImplementation((id) => ({
    select() { return this; },
    lean: async () => ({
      _id: String(id), username: String(id) === bob ? "bob" : "alice",
      color: accountColor(String(id)), phoneNumber: "+12025550123",
    }),
  }));
  jest.spyOn(SessionModel, "findOne").mockImplementation(async ({ sessionId }) => sessions.get(sessionId) ?? null);
  jest.spyOn(SessionModel, "deleteOne").mockImplementation(async ({ sessionId }) => sessions.delete(sessionId));
  jest.spyOn(MemberShipModel, "findOne").mockImplementation(async (filter) => memberships.find((m) =>
    m.room === filter.room && m.user === filter.user) ?? null);
  jest.spyOn(MemberShipModel, "find").mockImplementation((filter) => {
    const found = memberships.filter((m) => (!filter.room || m.room === filter.room) &&
      (!filter.user || (typeof filter.user === "string" ? m.user === filter.user : filter.user.$in.includes(m.user))));
    return { select() { return this; }, populate() { return this; }, lean: async () => found, distinct: async (field) => found.map((m) => m[field]) };
  });
  jest.spyOn(MemberShipModel, "bulkWrite").mockImplementation(async (operations) => {
    for (const { updateOne: { filter, update } } of operations) {
      if (!memberships.some((m) => m.room === String(filter.room) && m.user === filter.user)) {
        memberships.push({ ...update.$setOnInsert, room: String(filter.room), user: filter.user });
      }
    }
  });
  jest.spyOn(MemberShipModel, "deleteMany").mockImplementation(async (filter) => {
    memberships = memberships.filter((m) => m.room !== filter.room || !filter.user.$in.includes(m.user));
  });
  jest.spyOn(RoomModel, "findOne").mockResolvedValue({ _id: room, type: "group" });
  jest.spyOn(RoomModel, "create").mockResolvedValue({ _id: room, type: "group", name: "Team" });
  jest.spyOn(MessageModel, "create").mockImplementation(async (data) => {
    const message = { ...data, _id: `message-${messages.length}`, createdAt: new Date().toISOString() };
    messages.push(message);
    return message;
  });
  jest.spyOn(MessageModel, "find").mockImplementation((filter) => ({
    sort: async () => messages.filter((message) => message.room === filter.room).reverse(),
  }));
  server = createServer(app);
  io = initSockets(server);
  if (network) {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  }
});

afterEach(async () => {
  await Promise.all(clients.map((client) => client.close()));
  await new Promise((resolve) => io.close(resolve));
  setIO(undefined);
  jest.restoreAllMocks();
});

test.each(["", "session=missing", "session=expired"])("rejects unauthenticated/expired sockets (%s)", async (cookie) => {
  sessions.set("expired", { userId: alice, expiresAt: new Date(Date.now() - 1) });
  const client = new SocketClient(network ? baseUrl : io, cookie);
  clients.push(client);
  await client.connect();
  expect(await client.next("connect_error")).toMatchObject({ message: "Unauthorized" });
});

test("REST persists and delivers the complete message to room members only, using the authenticated sender", async () => {
  const [a, b, outsider] = await Promise.all([connect(), connect("bob"), connect("eve")]);
  const response = await request(server).post("/api/msg/sendmsg").set("Cookie", "session=alice")
    .send({ room, message: "hello", sender: eve }).expect(201);
  expect(response.body.message).toMatchObject({ room, message: "hello", sender: alice, _id: expect.any(String) });
  expect(await a.next("newMessage")).toEqual(response.body.message);
  expect(await b.next("newMessage")).toEqual(response.body.message);
  await expect(outsider.next("newMessage", 80)).rejects.toThrow("Timed out");
  expect(messages).toHaveLength(1);
});

test("socket send acknowledges the persisted message, with typing, leave and rejoin scoped to the room", async () => {
  const [a, b, outsider] = await Promise.all([connect(), connect("bob"), connect("eve")]);
  expect(await a.emit("typing", { room, isTyping: true })).toMatchObject({ ok: true });
  expect(await b.next("typing")).toEqual({ room, userId: alice, isTyping: true });
  await expect(a.next("typing", 80)).rejects.toThrow("Timed out");
  await expect(outsider.next("typing", 80)).rejects.toThrow("Timed out");
  expect(await b.emit("leaveRoom", { room })).toMatchObject({ ok: true });
  const sent = await a.emit("sendMessage", { room, message: "socket", sender: eve });
  expect(sent).toMatchObject({ ok: true, message: { message: "socket", sender: alice } });
  expect(await a.next("newMessage")).toEqual(sent.message);
  await expect(b.next("newMessage", 80)).rejects.toThrow("Timed out");
  expect(await b.emit("joinRoom", { room })).toMatchObject({ ok: true });
  await a.emit("sendMessage", { room, message: "back" });
  expect(await b.next("newMessage")).toMatchObject({ message: "back" });
});

test("rejects unauthorized room joins, sends, typing and history, and malformed payloads", async () => {
  const outsider = await connect("eve");
  for (const [event, payload] of [
    ["joinRoom", { room }], ["sendMessage", { room, message: "forbidden" }], ["typing", { room, isTyping: true }],
  ]) expect(await outsider.emit(event, payload)).toMatchObject({ ok: false, status: 403 });
  for (const payload of [null, [], { room: "bad", message: "hello" }, { room: otherRoom, message: " " },
    { room: otherRoom, message: "x".repeat(10001) }]) {
    expect(await outsider.emit("sendMessage", payload)).toMatchObject({ ok: false, status: 400 });
  }
  await request(server).get(`/api/msg/getroomhistory?room=${room}`).set("Cookie", "session=eve").expect(403);
  await request(server).post("/api/msg/sendmsg").set("Cookie", "session=eve")
    .send({ room, message: "forbidden" }).expect(403);
  expect(messages).toHaveLength(0);
});

test("does not broadcast failed saves over REST or sockets", async () => {
  const a = await connect();
  MessageModel.create.mockRejectedValue(new Error("DB unavailable"));
  await request(server).post("/api/msg/sendmsg").set("Cookie", "session=alice")
    .send({ room, message: "failed" }).expect(500);
  expect(await a.emit("sendMessage", { room, message: "failed" })).toMatchObject({ ok: false, status: 500 });
  await expect(a.next("newMessage", 80)).rejects.toThrow("Timed out");
});

test("history uses a GET query parameter and returns persisted messages", async () => {
  await request(server).post("/api/msg/sendmsg").set("Cookie", "session=alice").send({ room, message: "history" }).expect(201);
  const response = await request(server).get(`/api/msg/getroomhistory?room=${room}`)
    .set("Cookie", "session=bob").expect(200);
  expect(response.body.History).toEqual(messages);
});

test("room listings preserve room IDs and expose populated metadata and role", async () => {
  const query = {
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([{
      room: { _id: room, name: "Team", type: "group" },
      user: { _id: alice, username: "alice" },
      role: "owner",
    }, { room: null, user: { _id: alice } }]),
  };
  const participantQuery = {
    select() { return this; },
    populate() { return this; },
    lean: async () => [
      { room, user: { _id: alice, username: "alice" } },
      { room, user: { _id: bob, username: "bob" } },
      { room: otherRoom, user: { _id: eve, username: "eve" } },
    ],
  };
  MemberShipModel.find.mockReturnValueOnce(query).mockReturnValueOnce(participantQuery);
  const response = await request(server).post("/api/conv/getuserrooms")
    .set("Cookie", "session=alice").send({}).expect(200);
  expect(response.body.result).toEqual([{
    room, roomDetails: { _id: room, name: "Team", type: "group" },
    user: { _id: alice, username: "alice", color: accountColor(alice) }, role: "owner",
    participants: [{ _id: alice, username: "alice", color: accountColor(alice) }, { _id: bob, username: "bob", color: accountColor(bob) }],
  }]);
  expect(query.select).toHaveBeenCalledWith("room user role -_id");
  expect(query.populate).toHaveBeenCalledWith("room", "name type");
  expect(MemberShipModel.find).toHaveBeenLastCalledWith({ room: { $in: [room] } });
});

test("group creation rejects empty and whitespace-only names", async () => {
  for (const name of ["", "   "]) {
    await request(server).post("/api/conv/creategroup").set("Cookie", "session=alice")
      .send({ type: "group", name, members: [bob] }).expect(400);
  }
  expect(RoomModel.create).not.toHaveBeenCalled();
});

test("membership APIs subscribe added users and evict removed users across tabs", async () => {
  const [a, b, bTab, outsider] = await Promise.all([connect(), connect("bob"), connect("bob"), connect("eve")]);
  await request(server).post("/api/conv/addmembers").set("Cookie", "session=bob")
    .send({ roomId: room, newmembers: [eve] }).expect(403);
  await request(server).post("/api/conv/addmembers").set("Cookie", "session=alice")
    .send({ roomId: room, newmembers: [eve] }).expect(200);
  expect(await outsider.next("roomAdded")).toEqual({ room });
  await a.emit("sendMessage", { room, message: "welcome" });
  expect(await outsider.next("newMessage")).toMatchObject({ message: "welcome" });
  await b.next("newMessage");
  await bTab.next("newMessage");
  await request(server).post("/api/conv/removemembers").set("Cookie", "session=alice")
    .send({ roomId: room, members: [bob] }).expect(200);
  expect(await b.next("roomRemoved")).toEqual({ room });
  expect(await bTab.next("roomRemoved")).toEqual({ room });
  await a.emit("sendMessage", { room, message: "after removal" });
  await expect(b.next("newMessage", 80)).rejects.toThrow("Timed out");
  await expect(bTab.next("newMessage", 80)).rejects.toThrow("Timed out");
  expect(await b.emit("sendMessage", { room, message: "blocked" })).toMatchObject({ ok: false, status: 403 });
});

test("new rooms include the creator and notify connected members", async () => {
  const b = await connect("bob");
  const response = await request(server).post("/api/conv/creategroup").set("Cookie", "session=alice")
    .send({ type: "group", name: "Team", members: [bob] }).expect(200);
  expect(response.body.room._id).toBe(room);
  expect(await b.next("roomAdded")).toEqual({ room });
  expect(MemberShipModel.bulkWrite.mock.calls[0][0]).toHaveLength(2);
});

test("logout deletes the session, disconnects its tabs, and prevents reconnect", async () => {
  const [a, aTab, b] = await Promise.all([connect(), connect(), connect("bob")]);
  const response = await request(server).post("/api/auth/logout").set("Cookie", "session=alice").expect(200);
  expect(response.headers["set-cookie"][0]).toMatch(/^session=;/);
  await Promise.all([a.next("disconnect"), aTab.next("disconnect")]);
  expect(sessions.has("alice")).toBe(false);
  expect(await b.emit("typing", { room, isTyping: false })).toMatchObject({ ok: true });
  const invalid = new SocketClient(network ? baseUrl : io, "session=alice");
  clients.push(invalid);
  await invalid.connect();
  expect(await invalid.next("connect_error")).toMatchObject({ message: "Unauthorized" });
});

test("login sets the same development cookie used by REST and Socket.IO", async () => {
  jest.spyOn(UserModel, "findOne").mockResolvedValue({
    _id: alice, username: "alice", password: hash("secret"), color: accountColor(alice), phoneNumber: "+12025550123",
  });
  jest.spyOn(SessionModel.prototype, "save").mockImplementation(async function () {
    sessions.set(this.sessionId, this);
    return this;
  });
  const response = await request(server).post("/api/auth/login")
    .send({ username: "alice", password: "secret" }).expect(200);
  const cookie = response.headers["set-cookie"][0].split(";")[0];
  expect(cookie).toMatch(/^session=/);
  await request(server).get(`/api/msg/getroomhistory?room=${room}`).set("Cookie", cookie).expect(200);
  const client = new SocketClient(network ? baseUrl : io, cookie);
  clients.push(client);
  await client.connect();
  expect(await client.next("ready")).toMatchObject({ userId: alice, rooms: [room] });
});

test("expired and revoked sessions cannot keep sending on existing connections", async () => {
  const a = await connect();
  sessions.delete("alice");
  // The acknowledgement may be followed immediately by the disconnect packet.
  expect(await a.emit("sendMessage", { room, message: "revoked" })).toMatchObject({ ok: false, status: 401 });
  await a.next("disconnect");
  expect(messages).toHaveLength(0);
});

test("HTTP and socket handshakes share credentialed CORS and block untrusted origins", async () => {
  const response = await request(server).options("/api/msg/sendmsg")
    .set("Origin", "http://localhost:4200").expect(204);
  expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:4200");
  expect(response.headers["access-control-allow-credentials"]).toBe("true");
  await request(server).get("/socket.io/?EIO=4&transport=polling")
    .set("Origin", "https://untrusted.example").expect(403);
});

test("socket initialization backfills missing colors and blocks accounts without a phone before joining rooms", async () => {
  UserModel.findById.mockReturnValue({
    select() { return this; },
    lean: async () => ({ _id: alice, username: "alice" }),
  });
  const update = jest.spyOn(UserModel, "updateOne").mockResolvedValue({ modifiedCount: 1 });
  const client = new SocketClient(network ? baseUrl : io, "session=alice");
  clients.push(client);
  await client.connect();
  expect(await client.next("connect_error")).toMatchObject({
    message: "Add a primary phone number to continue",
    data: { code: "PHONE_REQUIRED", user: { requiresPhone: true, color: accountColor(alice) } },
  });
  expect(update).toHaveBeenCalled();
  expect(MemberShipModel.find).not.toHaveBeenCalled();
});
