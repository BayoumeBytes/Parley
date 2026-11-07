import { UserModel } from "../models/Users.js";
import { normalizePhone } from "../utils/phone.util.js";
import { chatError } from "./RoomAccessService.js";
import { accountColor } from "../../../shared/account-color.mjs";

export function publicUser(user) {
  const id = String(user._id ?? user);
  return {
    _id: id,
    username: user.username,
    color: user.color || accountColor(id),
  };
}

export function hasPrimaryPhone(user) {
  try {
    normalizePhone(user.phoneNumber);
    return true;
  } catch {
    return false;
  }
}

export async function accountProfile(user) {
  if (!user) throw chatError(401, "Account not found");
  const profile = publicUser(user);
  if (!user.color) {
    // Conditional, deterministic backfill: concurrent logins cannot replace a color.
    await UserModel.updateOne(
      {
        _id: user._id,
        $or: [{ color: { $exists: false } }, { color: null }, { color: "" }],
      },
      { $set: { color: profile.color } },
    );
  }
  return {
    ...profile,
    phoneNumber: user.phoneNumber ?? null,
    requiresPhone: !hasPrimaryPhone(user),
  };
}

export async function GetAccount(userId) {
  const user = await UserModel.findById(userId)
    .select("_id username phoneNumber color")
    .lean();
  return accountProfile(user);
}

export async function AddPrimaryPhone(userId, value) {
  const phoneNumber = normalizePhone(value);
  const profile = await GetAccount(userId);
  if (!profile.requiresPhone)
    throw chatError(409, "Your account already has a primary phone number");
  try {
    const saved = await UserModel.findOneAndUpdate(
      {
        _id: userId,
        $expr: {
          $eq: [
            { $ifNull: ["$phoneNumber", null] },
            { $literal: profile.phoneNumber },
          ],
        },
      },
      { $set: { phoneNumber } },
      { returnDocument: "after", runValidators: true },
    );
    if (!saved)
      throw chatError(409, "Your account was updated. Reload and try again");
    return accountProfile(saved);
  } catch (error) {
    if (error.code === 11000)
      throw chatError(409, "This primary phone number is already in use");
    throw error;
  }
}
