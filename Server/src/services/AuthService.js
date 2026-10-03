import { UserModel } from "../models/Users.js";
import { hash, verify } from "../utils/password.util.js";
import { generateSessionID, VerifySession } from "./SessionService.js";

export async function SignIn(username, password) {
  const user = await UserModel.findOne({ username });
  if (!user) {
    return null;
  }
  if (!verify(password, user.password)) {
    return "Invalid password";
  }
  const sessionId = generateSessionID();

  return sessionId;
}

export async function Register(username, password, email) {
  const user = await UserModel.findOne({
    $or: [
      { username: username },
      { email: username }, // Use the same variable if the input can be either
    ],
  });
  if (user) {
    return "User already exists";
  }
  const hashedPassword = hash(password);
  const Newuser = new UserModel({ username, password: hashedPassword, email });
  await Newuser.save();
}
