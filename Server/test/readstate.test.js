import mongoose from "mongoose";
import { MessageModel } from "../src/models/Messages.js";
import { MemberShipModel } from "../src/models/MemberShip.js";
import { GetRoomSummaries, MarkRoomRead, unreadFilter } from "../src/services/ReadStateService.js";

const user = "000000000000000000000001";
const room = "000000000000000000000011";
const otherRoom = "000000000000000000000012";
const id = "000000000000000000000021";
const createdAt = new Date("2026-11-05T12:00:00Z");
const message = { _id: new mongoose.Types.ObjectId(id), room, createdAt, sender: user, message: "Hello" };

afterEach(() => jest.restoreAllMocks());

test("unread filtering excludes the reader's sends and includes later messages in the same millisecond", () => {
  const filter = unreadFilter({ room, lastReadAt: createdAt, lastReadMessage: id }, user);
  expect(String(filter.room)).toBe(room);
  expect(String(filter.sender.$ne)).toBe(user);
  expect(filter.$or).toEqual([
    { createdAt: { $gt: createdAt } },
    { createdAt, _id: { $gt: new mongoose.Types.ObjectId(id) } },
  ]);
});

test("legacy membership uses its existing timestamp or join time until a message cursor is saved", () => {
  expect(unreadFilter({ room, joinedAt: createdAt }, user).$or).toEqual([
    { createdAt: { $gt: createdAt } }, { createdAt },
  ]);
});

test("room summaries restore unread totals and the latest preview in two batched queries", async () => {
  const aggregate = jest.spyOn(MessageModel, "aggregate")
    .mockResolvedValueOnce([{ _id: room, lastMessage: message }])
    .mockResolvedValueOnce([{ _id: room, unreadCount: 3 }]);
  const summary = await GetRoomSummaries([{ room, lastReadAt: createdAt }, { room: otherRoom }], user);
  expect(summary.get(room)).toEqual({ lastMessage: message, unreadCount: 3 });
  expect(aggregate).toHaveBeenCalledTimes(2);
  expect(aggregate.mock.calls[0][0][0]).toEqual({
    $match: { room: { $in: [new mongoose.Types.ObjectId(room), new mongoose.Types.ObjectId(otherRoom)] } },
  });
  expect(aggregate.mock.calls[1][0][0].$match.$or).toHaveLength(2);
});

test("no memberships requires no message queries", async () => {
  const aggregate = jest.spyOn(MessageModel, "aggregate");
  expect(await GetRoomSummaries([], user)).toEqual(new Map());
  expect(aggregate).not.toHaveBeenCalled();
});

test("read progress is bounded by an actual message and advances atomically without rewinding", async () => {
  jest.spyOn(MemberShipModel, "findOne").mockResolvedValue({ room, user });
  const find = jest.spyOn(MessageModel, "findOne").mockReturnValue({ lean: async () => message });
  const update = jest.spyOn(MemberShipModel, "updateOne").mockResolvedValue({ modifiedCount: 1 });
  expect(await MarkRoomRead(room, id, user)).toEqual({ room });
  expect(find).toHaveBeenCalledWith({ _id: id, room });
  expect(update).toHaveBeenCalledWith({
    room, user,
    $or: [
      { lastReadAt: { $lt: createdAt } },
      { lastReadAt: createdAt, lastReadMessage: { $lt: message._id } },
      { lastReadAt: createdAt, lastReadMessage: { $exists: false } },
      { lastReadAt: { $exists: false } },
    ],
  }, { $set: { lastReadAt: createdAt, lastReadMessage: message._id } });
});

test("non-members cannot save read progress", async () => {
  jest.spyOn(MemberShipModel, "findOne").mockResolvedValue(null);
  const update = jest.spyOn(MemberShipModel, "updateOne");
  await expect(MarkRoomRead(room, id, user)).rejects.toMatchObject({ status: 403 });
  expect(update).not.toHaveBeenCalled();
});

test("missing or foreign-room message IDs cannot advance the cursor", async () => {
  jest.spyOn(MemberShipModel, "findOne").mockResolvedValue({ room, user });
  jest.spyOn(MessageModel, "findOne").mockReturnValue({ lean: async () => null });
  const update = jest.spyOn(MemberShipModel, "updateOne");
  await expect(MarkRoomRead(room, id, user)).rejects.toMatchObject({ status: 404 });
  await expect(MarkRoomRead(room, "invalid", user)).rejects.toMatchObject({ status: 400 });
  expect(update).not.toHaveBeenCalled();
});
