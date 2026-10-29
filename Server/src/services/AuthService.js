import { UserModel } from "../models/Users.js";
import { SessionModel } from "../models/Session.js";
import { hash, verify } from "../utils/password.util.js";
import { generateSessionID } from "./SessionService.js";

export async function SignIn(username, password) {
  const user = await UserModel.findOne({ username });
  if (!user) {
    return null;
  }
  if (!verify(password, user.password)) {
    return "Invalid password";
  }
  const sessionId = generateSessionID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session = new SessionModel({
    sessionId: sessionId,
    userId: user._id,
    expiresAt,
  });
  await session.save();

  return { sessionId, expiresAt };
}

export async function Register(username, password, email) {
  const user = await UserModel.findOne({
    $or: [
      { username: username },
      { email: email }, // Use the same variable if the input can be either
    ],
  });
  if (user) {
    return "User already exists";
  }
  const hashedPassword = hash(password);
  const Newuser = new UserModel({ username, password: hashedPassword, email });
  await Newuser.save();
}
