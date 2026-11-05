import { UserModel } from "../models/Users.js";
import { normalizePhone } from "../utils/phone.util.js";
import { chatError } from "./RoomAccessService.js";

// Exact lookups only: do not expose a browsable directory or private contact fields.
export async function ResolveUsers(identifiers) {
  if (!Array.isArray(identifiers) || !identifiers.length || identifiers.length > 50 ||
      identifiers.some((value) => typeof value !== "string" || !value.trim() || value.length > 254)) {
    throw chatError(400, "Enter between 1 and 50 usernames, emails or international phone numbers");
  }
  const values = [...new Set(identifiers.map((value) => value.trim()))];
  const lookups = values.map((value) => ({
    value,
    phone: /^\+[\d\s().-]+$/.test(value) ? normalizePhone(value) : null,
  }));
  const users = await UserModel.find({
    $or: lookups.flatMap(({ value, phone }) => [
      { username: value }, { email: value }, ...(phone ? [{ phoneNumber: phone }] : []),
    ]),
  }).select("_id username email phoneNumber").lean();

  const resolved = lookups.map(({ value, phone }) => {
    const matches = users.filter((user) => user.username === value || user.email === value ||
      (phone && user.phoneNumber === phone));
    if (!matches.length) throw chatError(404, `No user found for "${value}"`);
    if (matches.length > 1) throw chatError(409, `More than one user matches "${value}". Use a different identifier`);
    return { _id: String(matches[0]._id), username: matches[0].username };
  });
  return [...new Map(resolved.map((user) => [user._id, user])).values()];
}
