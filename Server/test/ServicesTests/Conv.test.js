import { jest } from "@jest/globals";
import mongoose from "mongoose";
import {
  CreateMessage,
  GetRoomMessages,
} from "../../src/services/MessagesService.js";
import { MessageModel } from "../../src/models/Messages.js";

jest.mock("../../src/models/Messages.js", () => ({
  __esModule: true,
  MessageModel: { find: jest.fn(), create: jest.fn() },
}));

const { MessageModel: RealMessage } = jest.requireActual(
  "../../src/models/Messages.js",
);

const ROOM = new mongoose.Types.ObjectId().toString();
const SENDER = new mongoose.Types.ObjectId().toString();

const makeDoc = (overrides = {}) =>
  new RealMessage({ message: "hi", room: ROOM, sender: SENDER, ...overrides });

beforeEach(() => jest.clearAllMocks());

describe("GetRoomMessages", () => {
  it("returns Message documents for the room, newest first", async () => {
    const sort = jest
      .fn()
      .mockResolvedValue([makeDoc(), makeDoc({ message: "yo" })]);
    MessageModel.find.mockReturnValue({ sort });

    const result = await GetRoomMessages(ROOM);

    expect(MessageModel.find).toHaveBeenCalledWith({ room: ROOM });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    result.forEach((m) => {
      expect(m).toBeInstanceOf(RealMessage);
      expect(m.validateSync()).toBeUndefined();
      expect(m.toObject()).toEqual({
        _id: expect.any(mongoose.Types.ObjectId),
        message: expect.any(String),
        room: expect.any(mongoose.Types.ObjectId),
        sender: expect.any(mongoose.Types.ObjectId),
      });
    });
  });

  it("returns an error object when the query returns nothing", async () => {
    MessageModel.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue(null),
    });

    expect(await GetRoomMessages(ROOM)).toEqual({
      error: "failed to get messages",
    });
  });

  it("returns the error message when the query throws", async () => {
    MessageModel.find.mockReturnValue({
      sort: jest.fn().mockRejectedValue(new Error("db down")),
    });

    expect(await GetRoomMessages(ROOM)).toEqual({ error: "db down" });
  });
});

describe("CreateMessage", () => {
  it("creates a message with the right fields and returns it", async () => {
    const doc = makeDoc();
    MessageModel.create.mockResolvedValue(doc);

    const result = await CreateMessage("hi", ROOM, SENDER);

    expect(MessageModel.create).toHaveBeenCalledWith({
      message: "hi",
      room: ROOM,
      sender: SENDER,
    });
    expect(result).toBeInstanceOf(RealMessage);
    expect(result.validateSync()).toBeUndefined();
  });

  it("returns an error object when create returns nothing", async () => {
    MessageModel.create.mockResolvedValue(null);

    expect(await CreateMessage("hi", ROOM, SENDER)).toEqual({
      error: "failed to create message",
    });
  });

  it("returns the error message when create throws", async () => {
    MessageModel.create.mockRejectedValue(new Error("validation failed"));

    expect(await CreateMessage("hi", ROOM, SENDER)).toEqual({
      error: "validation failed",
    });
  });
});
