import { UserModel } from "../models/Users.js";
import { SessionModel } from "../models/Session.js";
import { hash, verify } from "../utils/password.util.js";
import { generateSessionID } from "./SessionService.js";
import { normalizePhone } from "../utils/phone.util.js";
import { chatError } from "./RoomAccessService.js";
import { accountProfile } from "./AccountService.js";
import { accountColor } from "../../../shared/account-color.mjs";
import { config } from "../config/config.js";

export async function SignIn(username, password) {
  const user = await UserModel.findOne({ username });
  if (!user) {
    return null;
  }
  if (!verify(password, user.password)) {
    return "Invalid password";
  }
  const profile = await accountProfile(user);
  const sessionId = generateSessionID();
  const expiresAt = new Date(Date.now() + config.sessionTtlMs);
  const session = new SessionModel({
    sessionId: sessionId,
    userId: user._id,
    expiresAt,
  });
  await session.save();

  return { sessionId, expiresAt, user: profile };
}

export async function Register(username, password, email, phoneNumber) {
  if ([username, password, email].some((value) => typeof value !== "string" || !value.trim())) {
    throw chatError(400, "Username, email, password and primary phone number are required");
  }
  username = username.trim();
  email = email.trim();
  phoneNumber = normalizePhone(phoneNumber);
  const user = await UserModel.findOne({
    $or: [
      { username: username },
      { email: email },
      { phoneNumber },
    ],
  });
  if (user) {
    return "User already exists";
  }
  const hashedPassword = hash(password);
  const Newuser = new UserModel({ username, password: hashedPassword, email, phoneNumber });
  Newuser.color = accountColor(String(Newuser._id));
  await Newuser.save();
}
