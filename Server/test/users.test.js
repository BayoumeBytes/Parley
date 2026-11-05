import { createServer } from "node:http";
import { app } from "../src/app.js";
import { localRequest } from "./helpers/localRequest.js";
import { UserModel } from "../src/models/Users.js";
import { SessionModel } from "../src/models/Session.js";
import { ResolveUsers } from "../src/services/UserService.js";
import { normalizePhone } from "../src/utils/phone.util.js";

const server = createServer(app);
const alice = "000000000000000000000001";
const bob = { _id: "000000000000000000000002", username: "bob", email: "bob@example.com", phoneNumber: "+201012345678" };
const signup = { username: "alice", email: "alice@example.com", password: "secret", phoneNumber: "+1 (202) 555-0123" };
const query = (users) => ({ select: jest.fn().mockReturnThis(), lean: async () => users });

afterEach(() => jest.restoreAllMocks());

test("normalizes phone formatting and rejects missing country codes or invalid lengths", () => {
  expect(normalizePhone("+1 (202) 555-0123")).toBe("+12025550123");
  for (const value of [undefined, "", "2025550123", "+0123456789", "+123", "+1234567890123456", "+1234abc5678"]) {
    expect(() => normalizePhone(value)).toThrow();
  }
});

test("user model requires a phone and defines a database-backed unique index for it", async () => {
  const user = new UserModel({ ...signup, phoneNumber: undefined });
  await expect(user.validate()).rejects.toThrow();
  expect(UserModel.schema.indexes()).toContainEqual([
    { phoneNumber: 1 },
    expect.objectContaining({ unique: true, partialFilterExpression: { phoneNumber: { $type: "string" } } }),
  ]);
});

test("registration requires and persists the normalized primary phone", async () => {
  const find = jest.spyOn(UserModel, "findOne").mockResolvedValue(null);
  const save = jest.spyOn(UserModel.prototype, "save").mockResolvedValue(undefined);
  const response = await localRequest(server).post("/api/auth/register").send(signup).expect(201);
  expect(response.body).toEqual({ message: "registered" });
  expect(find).toHaveBeenCalledWith({ $or: [
    { username: "alice" }, { email: "alice@example.com" }, { phoneNumber: "+12025550123" },
  ] });
  expect(save.mock.instances[0].phoneNumber).toBe("+12025550123");
  expect(save.mock.instances[0].password).not.toBe(signup.password);
});

test("registration rejects missing/invalid phones and blank required fields", async () => {
  const find = jest.spyOn(UserModel, "findOne");
  for (const change of [{ phoneNumber: undefined }, { phoneNumber: "123" }, { username: " " }, { email: {} }]) {
    await localRequest(server).post("/api/auth/register").send({ ...signup, ...change }).expect(400);
  }
  expect(find).not.toHaveBeenCalled();
});

test("registration returns conflict for an existing phone", async () => {
  jest.spyOn(UserModel, "findOne").mockResolvedValue(bob);
  const save = jest.spyOn(UserModel.prototype, "save");
  await localRequest(server).post("/api/auth/register").send(signup).expect(409);
  expect(save).not.toHaveBeenCalled();
});

test("registration handles a concurrent duplicate-key failure as conflict", async () => {
  jest.spyOn(UserModel, "findOne").mockResolvedValue(null);
  jest.spyOn(UserModel.prototype, "save").mockRejectedValue(Object.assign(new Error("duplicate"), { code: 11000 }));
  await localRequest(server).post("/api/auth/register").send(signup).expect(409);
});

test("authenticated exact lookups resolve username, email and formatted phone without leaking contacts", async () => {
  jest.spyOn(SessionModel, "findOne").mockResolvedValue({
    userId: alice, sessionId: "alice", expiresAt: new Date(Date.now() + 60000),
  });
  const find = jest.spyOn(UserModel, "find").mockReturnValue(query([bob]));
  const response = await localRequest(server).post("/api/users/resolve").set("Cookie", "session=alice")
    .send({ identifiers: ["bob", "bob@example.com", "+20 101 234 5678"] }).expect(200);
  expect(response.body).toEqual({ users: [{ _id: bob._id, username: "bob" }] });
  expect(find.mock.calls[0][0].$or).toContainEqual({ phoneNumber: "+201012345678" });
});

test("user lookup requires authentication", async () => {
  const find = jest.spyOn(UserModel, "find");
  await localRequest(server).post("/api/users/resolve").send({ identifiers: ["bob"] }).expect(401);
  expect(find).not.toHaveBeenCalled();
});

test("lookups reject missing users, ambiguous identities, and invalid input instead of selecting a wrong account", async () => {
  const find = jest.spyOn(UserModel, "find").mockReturnValue(query([]));
  await expect(ResolveUsers(["nobody"])).rejects.toMatchObject({ status: 404 });
  find.mockReturnValue(query([bob, { ...bob, _id: alice, username: "other", email: "bob" }]));
  await expect(ResolveUsers(["bob"])).rejects.toMatchObject({ status: 409 });
  for (const input of [[], [" "], [{}], Array(51).fill("bob")]) {
    await expect(ResolveUsers(input)).rejects.toMatchObject({ status: 400 });
  }
});
