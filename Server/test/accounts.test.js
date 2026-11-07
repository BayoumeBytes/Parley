import { createServer } from "node:http";
import { app } from "../src/app.js";
import { localRequest } from "./helpers/localRequest.js";
import { UserModel } from "../src/models/Users.js";
import { SessionModel } from "../src/models/Session.js";
import { accountColor } from "../../shared/account-color.mjs";
import { accountProfile } from "../src/services/AccountService.js";
import { hash } from "../src/utils/password.util.js";

const server = createServer(app);
const id = "1234567890abcdef12345678";
const legacy = { _id: id, username: "legacy" };
const complete = {
  ...legacy,
  phoneNumber: "+12025550123",
  color: accountColor(id),
};
const query = (user) => ({
  select() {
    return this;
  },
  lean: async () => user,
});

beforeEach(() => {
  jest.spyOn(SessionModel, "findOne").mockResolvedValue({
    sessionId: "test",
    userId: id,
    expiresAt: new Date(Date.now() + 60000),
  });
  jest.spyOn(UserModel, "findById").mockReturnValue(query(legacy));
  jest.spyOn(UserModel, "updateOne").mockResolvedValue({ modifiedCount: 1 });
});
afterEach(() => jest.restoreAllMocks());

test("shared color function applies the UUID XOR fold and normalizes the highest RGB channel to 230", () => {
  expect(accountColor(id)).toBe("#a5c5e6");
  expect(accountColor("00000000-0000-0000-0000-000000ff0000")).toBe("#e60000");
  expect(accountColor("00000000-0000-0000-0000-00000000ff00")).toBe("#00e600");
  expect(accountColor("00000000-0000-0000-0000-0000000000ff")).toBe("#0000e6");
  expect(accountColor("000000000000000000000000")).toBe("#e6e6e6");
  expect(accountColor(id.toUpperCase())).toBe(accountColor(id));
});

test("legacy color backfill is conditional and independent of username", async () => {
  const first = await accountProfile(legacy);
  const renamed = await accountProfile({ ...legacy, username: "renamed" });
  expect(first.color).toBe(renamed.color);
  expect(UserModel.updateOne).toHaveBeenCalledWith(
    {
      _id: id,
      $or: [{ color: { $exists: false } }, { color: null }, { color: "" }],
    },
    { $set: { color: accountColor(id) } },
  );
});

test("an existing color is permanent and is not replaced on profile loading", async () => {
  expect((await accountProfile({ ...complete, color: "#48e695" })).color).toBe(
    "#48e695",
  );
  expect(UserModel.updateOne).not.toHaveBeenCalled();
});

test("session restoration returns only the caller's safe profile and requires their missing number", async () => {
  const result = await localRequest(server)
    .get("/api/auth/me")
    .set("Cookie", "session=test")
    .expect(200);
  expect(result.body).toEqual({
    user: {
      _id: id,
      username: "legacy",
      color: accountColor(id),
      phoneNumber: null,
      requiresPhone: true,
    },
  });
  expect(UserModel.findById).toHaveBeenCalledWith(id);
});

test("legacy login assigns color and returns phone onboarding status with a valid session", async () => {
  jest
    .spyOn(UserModel, "findOne")
    .mockResolvedValue({ ...legacy, password: hash("secret") });
  jest.spyOn(SessionModel.prototype, "save").mockResolvedValue(undefined);
  const result = await localRequest(server)
    .post("/api/auth/login")
    .send({ username: "legacy", password: "secret" })
    .expect(200);
  expect(result.body.user.requiresPhone).toBe(true);
  expect(result.body.user.color).toBe(accountColor(id));
  expect(result.body.user.password).toBeUndefined();
  expect(result.headers["set-cookie"][0]).toMatch(/^session=/);
});

test("chat APIs reject accounts without a phone even if the frontend gate is bypassed", async () => {
  for (const path of [
    "/api/conv/getuserrooms",
    "/api/msg/sendmsg",
    "/api/users/resolve",
  ]) {
    const result = await localRequest(server)
      .post(path)
      .set("Cookie", "session=test")
      .send({})
      .expect(403);
    expect(result.body.code).toBe("PHONE_REQUIRED");
  }
});

test("phone completion requires authentication", async () => {
  const update = jest.spyOn(UserModel, "findOneAndUpdate");
  await localRequest(server)
    .post("/api/auth/phone")
    .send({ phoneNumber: "+12025550123" })
    .expect(401);
  expect(update).not.toHaveBeenCalled();
});

test("phone completion normalizes and only updates the authenticated account", async () => {
  const update = jest
    .spyOn(UserModel, "findOneAndUpdate")
    .mockResolvedValue(complete);
  const result = await localRequest(server)
    .post("/api/auth/phone")
    .set("Cookie", "session=test")
    .send({
      phoneNumber: "+1 (202) 555-0123",
      userId: "someone-else",
      color: "#ffffff",
    })
    .expect(200);
  expect(update).toHaveBeenCalledWith(
    {
      _id: id,
      $expr: { $eq: [{ $ifNull: ["$phoneNumber", null] }, { $literal: null }] },
    },
    { $set: { phoneNumber: "+12025550123" } },
    { returnDocument: "after", runValidators: true },
  );
  expect(result.body.user.requiresPhone).toBe(false);
  expect(result.body.user.color).toBe(accountColor(id));
});

test("invalid phones are rejected without a database update", async () => {
  const update = jest.spyOn(UserModel, "findOneAndUpdate");
  for (const phoneNumber of [undefined, "", "2025550123", "+12abc"]) {
    await localRequest(server)
      .post("/api/auth/phone")
      .set("Cookie", "session=test")
      .send({ phoneNumber })
      .expect(400);
  }
  expect(update).not.toHaveBeenCalled();
});

test("duplicate phones return a conflict so onboarding can be retried", async () => {
  jest
    .spyOn(UserModel, "findOneAndUpdate")
    .mockRejectedValue(Object.assign(new Error("duplicate"), { code: 11000 }));
  const result = await localRequest(server)
    .post("/api/auth/phone")
    .set("Cookie", "session=test")
    .send({ phoneNumber: "+12025550123" })
    .expect(409);
  expect(result.body.error).toBe("This primary phone number is already in use");
});

test("completion cannot overwrite an existing valid primary number", async () => {
  UserModel.findById.mockReturnValue(query(complete));
  const update = jest.spyOn(UserModel, "findOneAndUpdate");
  await localRequest(server)
    .post("/api/auth/phone")
    .set("Cookie", "session=test")
    .send({ phoneNumber: "+201012345678" })
    .expect(409);
  expect(update).not.toHaveBeenCalled();
});

test("accounts with no phone can still log out", async () => {
  jest.spyOn(SessionModel, "deleteOne").mockResolvedValue({ deletedCount: 1 });
  await localRequest(server)
    .post("/api/auth/logout")
    .set("Cookie", "session=test")
    .send({})
    .expect(200);
});
